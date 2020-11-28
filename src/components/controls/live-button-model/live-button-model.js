import storage from "../../../dataStore/index";
import { checkIfLive, getLiveTime } from "../../../utils/helper";
import splSrv from "../../../spartanlync/services";

export const liveButtonModel = {
   liveDot: undefined,
   liveButton: undefined,
   islive: true,

   initLiveButton() {
      this.liveDot = document.getElementById("RTM-LiveDot");
      this.liveButton = document.getElementById("RTM-LiveButton");
      this.setLiveBackground();
      storage.dateKeeper$.subscribe(this.monitorLiveBtnStatus.bind(this));

      splSrv.events.register("trOnDomLoaded", () => {
         document.querySelector("#RTM-LiveButton .go-live-help").innerHTML = splmap.tr("splmap_controlspanel_label_live_help");
      }, false);
   },

   monitorLiveBtnStatus(currentSecond) {
      const timeAhead = checkIfLive(currentSecond);

      if (timeAhead) {
         if (timeAhead > 1800) {
            this.islive = false;
            this.goToLive();
            return;
         }

         if (!this.islive) {
            storage.dateKeeper$.setPeriod(1000);
            this.islive = true;
            this.setLiveBackground();
         }
         return true;

      } else {

         if (this.islive) {
            this.islive = false;
            this.setNotLiveBackground();
         }

         return false;
      }
   },

   setLiveBackground() {
      const playbackSpeedDropdown = document.getElementsByClassName("mdc-select__native-control");
      playbackSpeedDropdown[0].setAttribute("disabled", "");
      playbackSpeedDropdown[0].classList.add("disabledDropdown");
      this.liveButton.classList.add("set-live");
   },

   setNotLiveBackground() {
      const playbackSpeedDropdown = document.getElementsByClassName("mdc-select__native-control");
      playbackSpeedDropdown[0].removeAttribute("disabled");
      playbackSpeedDropdown[0].classList.remove("disabledDropdown");
      this.liveButton.classList.remove("set-live");
   },

   goToLive() {
      if (!this.islive) {
         const liveTime = new Date(getLiveTime());
         this.islive = true;
         this.setLiveBackground();
         storage.dateKeeper$.period = 1000;
         storage.dateKeeper$.setNewTime(liveTime);
      }
   }
};