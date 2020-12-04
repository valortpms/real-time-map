import storage from "../../../dataStore";
import splSrv from "../../../spartanlync/services";
import { MDCSelect } from "@material/select";
import { checkIfLive } from "../../../utils/helper";

export const playBackSpeedModel = {
   select: undefined,
   speedUpdated: false,

   initPlayBackSpeed() {
      playBackSpeedModel.select = new MDCSelect(document.querySelector(".mdc-select"));
      playBackSpeedModel.select.listen("MDCSelect:change", this.newSpeedSelected.bind(this));
      splSrv.events.register("onDateTimeChanged", () => this.resetToDefault(), false);
   },

   resetToDefault() {
      // Bug Workaround, forcing datekeeper to accept 1x speed change by re-submitting change Event
      if (playBackSpeedModel.select.value > 1) {
         setTimeout(function () {
            playBackSpeedModel.select.value = 1;
         }, 500);
      }
      playBackSpeedModel.select.value = 1;
   },

   newSpeedSelected() {
      if (this.speedUpdated) {
         this.speedUpdated = false;
         return;
      }
      this.speedUpdated = true;

      const timeAhead = checkIfLive(storage.currentTime);
      if (timeAhead) {
         playBackSpeedModel.select.value = 1;
      }
      else {
         const { value } = playBackSpeedModel.select;
         storage.dateKeeper$.setPeriod(1000 / value);
      }
   },

   updateSpeed(period) {
      this.speedUpdated = true;
      const speed = 1000 / period;
      playBackSpeedModel.select.value = Math.round(speed);
   }
};