import splCfg from "./config";
console.log("appEnv = " + splCfg.appEnv);

const playBtnBgColor = (splCfg.appEnv === "dev" ? "#FF0000" : "#000000");
const styles = {
   playBtnStyle: {
      backgroundColor: playBtnBgColor
   }
};

export default styles;
