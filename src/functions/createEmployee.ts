import { APIGatewayProxyHandler } from "aws-lambda";
import { readFileSync } from "fs";
import { compile } from "handlebars";
import { join } from "path";
import { S3 } from "aws-sdk";
import { document } from "../utils/dynamodbClient";
import dayjs from "dayjs";
import { deburr, replace, startCase, toUpper } from "lodash";
import { chromium } from "playwright-core";

interface IEmployeeData {
  rawfullname: string;
  rawcodename: string;
  canac?: string;
  address: string;
  rawneighborhood: string;
  rawcity: string;
  rawstate: string;
  rawcpf: string;
  rawrg: string;
  birthDate: string;
  hiringDate: string;
  emergencyContact: string;
  rawbloodtype: string;
  rawcellphone: string;
  email: string;
  rawcep: string;
  updatedAt: string;
  createdAt: string;
}

interface ITemplate {
  fullname: string;
  codename: string;
  canac?: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  cpf: string;
  rg: string;
  birthDate: string;
  hiringDate: string;
  emergencyContact: string;
  bloodtype: string;
  cellphone: string;
  email: string;
  cep: string;
  updatedAt: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  // Get data from event
  const {
    rawfullname,
    rawcodename,
    canac,
    address,
    rawneighborhood,
    rawcity,
    rawstate,
    rawrg,
    rawcpf,
    birthDate,
    hiringDate,
    email,
    emergencyContact,
    rawcellphone,
    rawcep,
    rawbloodtype,
  } = JSON.parse(event.body) as IEmployeeData;

  function cleanState(rawstate: string) {
    if (rawstate.length > 2) {
      const words = rawstate.split(" ");
      const initials = words.map(word => word.charAt(0));
      const outputString = toUpper(initials.join(""));

      return outputString;
    }
  }

  function cleanCellphone(rawcellphone: string) {
    let phone = rawcellphone
    phone = replace(phone," ","")
    phone = replace(phone,"-","")
    phone = replace(phone,"(","")
    phone = replace(phone,")","")
    return phone;
  }

  function cleanDocNumber(inputNumber: string) {
    let docNumber = inputNumber;
    docNumber = toUpper(replace(docNumber,".",""));
    docNumber = toUpper(replace(docNumber,".",""));
    docNumber = toUpper(replace(docNumber,"-",""));

    return docNumber;
  }

  const codename = deburr(toUpper(rawcodename));




  const response = await document.query({
    TableName: "Employee",
    KeyConditionExpression: "codename = :codename",
    ExpressionAttributeValues:{
      ":codename": codename,
    },
  }).promise();

  const fullname = startCase(rawfullname);
  const neighborhood = startCase(rawneighborhood);
  const city = startCase(rawcity);
  const state = cleanState(rawstate);
  const cpf = cleanDocNumber(rawcpf);
  const rg = toUpper(cleanDocNumber(rawrg));
  const cep = cleanDocNumber(rawcep);
  const cellphone = cleanCellphone(rawcellphone);
  const bloodtype = toUpper(rawbloodtype);

  const employeeAlreadyExists = response.Items[0];

  const updatedAt = dayjs().format("DD/MM/YYYY");
  const createdAt = dayjs().format("DD/MM/YYYY");

  if (!employeeAlreadyExists) {
    await document
      .put({
        TableName: "Employee",
        Item: {
          fullname,
          codename,
          canac,
          address,
          neighborhood,
          city,
          state,
          rg,
          cpf,
          birthDate,
          hiringDate,
          email,
          emergencyContact,
          cellphone,
          cep,
          bloodtype,
          createdAt,
          updatedAt,
        },
      })
      .promise();
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Employee (${codename}) already exists! Last updated at: ${updatedAt}`,
        employeeAlreadyExists
      }),
      headers: {
        "Content-type": "application/json",
      },
    }
  }

  const data: ITemplate = {
    fullname,
    codename,
    canac,
    address,
    neighborhood,
    city,
    state,
    rg,
    cpf,
    birthDate,
    hiringDate,
    email,
    emergencyContact,
    cellphone,
    cep,
    bloodtype,
    updatedAt,
  }


  // Compile Handlebars template
  const filePath = join(process.cwd(), "src", "templates", "employeeFile.hbs")
  const templateSource = readFileSync(filePath, 'utf8');
  const template = compile(templateSource);

  // Generate HTML from template and data
  const html = template(data);

  // Convert HTML to PDF
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({
    format:'a4',
    landscape:false,
    path: process.env.IS_OFFLINE ? `./${codename}.pdf` : null,
    printBackground:true,
    preferCSSPageSize:true,
  });
  await browser.close();

  // Save PDF to S3 bucket
  const s3 = new S3({ region: "us-east-1"});
  const params = {
      Bucket: 'acbp-employee-file',
      Key: `${codename}`,
      ACL: "public-read",
      ContentType: "application/pdf",
      Body: pdf,
    };
    try {
      s3.putObject(params);
    } catch (error) {
      return {
        statusCode: 200,
        body: JSON.stringify({
        message: error,
      }),
      }
    }


    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "PDF generated successfuly!",
        url: `https://acbp-employee-file.s3.amazonaws.com/${codename}`,
      }),
      headers: {
        "Content-type": "application/json",
      },
  };
};
