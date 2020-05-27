import splCfg from "../config";

const playBtnBgColor = (splCfg.appEnv === "dev" ? "#FF0000" : "#FFFFFF");
const styles = {
   playBtnStyle: {
      backgroundColor: playBtnBgColor
   }
};

export default styles;
