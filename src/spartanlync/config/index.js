import splConfigDev from "./dev";
import splConfigProd from "./prod";
const splConfig = (process.env.NODE_ENV === "development" ? splConfigDev : splConfigProd);
export default splConfig;
