import type { AWS } from '@serverless/typescript';

const serverlessConfiguration: AWS = {
  service: 'acbp',
  frameworkVersion: '3',
  plugins: [
    'serverless-esbuild',
    'serverless-dynamodb-local',
    'serverless-offline',
  ],
  provider: {
    name: 'aws',
    runtime: 'nodejs14.x',
    region: 'us-east-1',
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      NODE_OPTIONS: '--enable-source-maps --stack-trace-limit=1000',
    },
    iam: {
      role:{
        statements: [
          {
            Effect: "Allow",
            Action: ["dynamodb:*"],
            Resource: ["*"]
          },
          {
            Effect: "Allow",
            Action: ["s3:*"],
            Resource: ["*"]
          }
        ]
      }
    }
  },
  // import the function via paths
  functions: {
    createEmployee: {
      handler: "src/functions/createEmployee.handler",
      events: [
        {
          http: {
            path: "createEmployee",
            method: "post",

            cors: true,
          }
        }
      ]
    }
  },
  package: { individually: false, include: ["./src/templates/**"], exclude: ["./node_modules/puppeteer/.local-chroium/**"] },
  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ['aws-sdk'],
      target: 'node14',
      define: { 'require.resolve': undefined },
      platform: 'node',
      concurrency: 10,
    },
    dynamodb: {
      stages: ["dev", "local"],
      start:{
        port: "8000",
        inMemory: true,
        migrate: true,
      }
    }
  },
  resources: {
    Resources: {
      employeeDatabase: {
        Type: "AWS::DynamoDB::Table",
        Properties: {
          TableName: "Employee",
          ProvisionedThroughput:  {
            ReadCapacityUnits: "5",
            WriteCapacityUnits: "5",
          },
          AttributeDefinitions: [
             {
              AttributeName: "codename",
              AttributeType: "S",
             }
          ],
          KeySchema: [
            {
              AttributeName: "codename",
              KeyType: "HASH"
            }
          ]
        }
      }
    }
  }
};

module.exports = serverlessConfiguration;
