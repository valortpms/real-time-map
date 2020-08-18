import "./lang.en";
import "./lang.es";
import "./lang.fr";
import splSrv from "../services";
import splConfigDev from "./dev";
import splConfigProd from "./prod";

const splConfig = (
   process.env.NODE_ENV === "development" || document.baseURI.indexOf(splSrv.devDomain) > -1
      ? splConfigDev : splConfigProd
);
export default splConfig;
