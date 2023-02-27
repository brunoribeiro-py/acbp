const { replace, toUpper } = require("lodash");

let rg = "453.859.598-55";
rg = toUpper(replace(rg,".",""));
rg = toUpper(replace(rg,".",""));
rg = toUpper(replace(rg,"-",""));