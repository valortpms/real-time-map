import storage from "../../../dataStore";
import moment from "moment-timezone";
import splSrv from "../../../spartanlync/services";
import { getLiveTime } from "../../../utils/helper";
import { showSnackBar } from "../../snackbar/snackbar";
import { ENTER_KEY } from "../../../constants/key-codes";

export const dateTimeModel = {

   get dateInput() {
      return document.getElementById("dateInputBox");
   },

   get startTimeInput() {
      return document.getElementById("timeRangeStart");
   },

   get currentTimeInput() {
      return document.getElementById("currentTimeInput");
   },

   get applyBtns() {
      return document.querySelectorAll("#RTM-ControlsContainer > .inputControls > .apply-changes-btn");
   },

   get timezoneAbrs() {
      return document.querySelectorAll("#RTM-ControlsContainer > .inputControls > .timezoneAbr");
   },

   get controlBarObj() {
      return document.getElementById("RTM-ControlBarContainer");
   },

   initDateTimeInput() {

      this.setDateValue();
      this.setStartTimeValue();
      this.setCurrentTimeValue();

      this.dateInput.addEventListener("change", this.onChangeSaveDateTimeInput.bind(this));
      this.startTimeInput.addEventListener("change", this.onChangeSaveDateTimeInput.bind(this));
      this.currentTimeInput.addEventListener("change", this.onChangeSaveDateTimeInput.bind(this));

      for (const applyBtn of this.applyBtns) {
         applyBtn.addEventListener("click", this.onApplyBtnClicked.bind(this));
      }
      storage.dateKeeper$.subscribe(this.updateCurrentSecond.bind(this));
      splSrv.events.register("onUpdateCurrentSecond", (timestamp) => this.updateCurrentSecond(timestamp));

      // Set Timezone Abbreviation
      splSrv.events.register("onLoadSplServices", () => this.setTimezoneAbrValue());

      // On ENTER keyboard key, Click any the active APPLY button
      splSrv.events.register("onLoadSplServices", () => document.addEventListener("keyup", this.keyENTEROnApplyBtn.bind(this)));
   },

   setTimezoneAbrValue() {
      const timeZoneAbr = moment().format("z");
      for (const timezoneElem of this.timezoneAbrs) {
         timezoneElem.innerHTML = timeZoneAbr;
      }
   },

   setDateValue() {
      this.dateInput.value = moment.unix(storage.currentTime).format("YYYY-MM-DD");
      this.clearApplyBtn(this.dateInput);
   },

   setStartTimeValue() {
      this.startTimeInput.value = isNaN(storage.timeRangeStart) ? this.startTimeInput.value : moment.unix(storage.timeRangeStart).format("HH:mm:ss");
      this.clearApplyBtn(this.startTimeInput);
   },

   setCurrentTimeValue() {
      this.currentTimeInput.value = isNaN(storage.currentTime) ? this.currentTimeInput.value : moment.unix(storage.currentTime).format("HH:mm:ss");
   },

   clearApplyBtn(inputElem) {
      const buttonObj = inputElem.parentElement.querySelector("button.apply-changes-btn");
      if (typeof buttonObj !== "undefined" && buttonObj.classList.contains("active")) {
         // Create a small micro-delay to allow for the CLICK user-interaction before clearing the button from UI
         setTimeout(function () {
            buttonObj.classList.remove("active");
            buttonObj.removeAttribute("data-input-val");
         }, 500);
      }
   },

   keyENTEROnApplyBtn(evt) {
      evt.preventDefault();
      if (evt.keyCode === ENTER_KEY) {
         for (const applyBtn of this.applyBtns) {
            if (typeof applyBtn !== "undefined" && applyBtn.classList.contains("active")) {
               applyBtn.click();
               setTimeout(() => this.clearApplyBtn(applyBtn.previousElementSibling), 100);
            }
         }
      }
   },

   // eslint-disable-next-line no-unused-vars
   updateCurrentSecond(currentSecond) {

      if (this.dateInput && document.activeElement !== this.dateInput) {
         this.setDateValue();
      }

      if (this.startTimeInput && document.activeElement !== this.startTimeInput) {
         this.setStartTimeValue();
      }

      if (this.currentTimeInput && document.activeElement !== this.currentTimeInput) {
         this.setCurrentTimeValue();
         this.clearApplyBtn(this.currentTimeInput);
      }
   },

   applyAndUpdate(newTime, disableTimeControls) {
      if (typeof disableTimeControls !== "undefined" && disableTimeControls) {

         // Note which map popups were open, and re-open after dateTime update
         splSrv.events.exec("onMapDateChangeResetReOpenPopups", newTime);

         // Disable UI while Map is reset to new date/time, then enable UI after Map date/time update
         this.disableTimeControls();
         splSrv.events.register("onDateUpdate", () => this.enableTimeControls());
      }
      storage.dateKeeper$.setNewTime(newTime);
   },

   disableTimeControls() {
      if (typeof this.controlBarObj !== "undefined" && !this.controlBarObj.classList.contains("disable")) {
         this.controlBarObj.classList.add("disable");
      }
   },

   enableTimeControls() {
      if (typeof this.controlBarObj !== "undefined" && this.controlBarObj.classList.contains("disable")) {
         this.controlBarObj.classList.remove("disable");
      }
   },

   onChangeSaveDateTimeInput(evt) {
      const buttonObj = evt.target.parentElement.querySelector("button.apply-changes-btn");
      const inputElemName = buttonObj.getAttribute("data-input-name");
      evt.preventDefault();
      evt.stopPropagation();

      if (typeof buttonObj !== "undefined" && inputElemName) {
         let inputElemVal = "";
         switch (inputElemName) {
            case "dateInputBox":
               inputElemVal = this.dateInput.value;
               break;

            case "timeRangeStart":
               inputElemVal = this.startTimeInput.value;
               break;

            case "currentTimeInput":
               inputElemVal = this.currentTimeInput.value;
               break;
         }
         if (!buttonObj.classList.contains("active")) {
            buttonObj.classList.add("active");
         }
         buttonObj.setAttribute("data-input-val", inputElemVal);
      }
   },

   onApplyBtnClicked(evt) {
      const buttonObj = evt.target.parentElement.querySelector("button.apply-changes-btn");
      const inputElemName = buttonObj.getAttribute("data-input-name");
      const inputElemVal = buttonObj.getAttribute("data-input-val");

      evt.preventDefault();
      evt.stopPropagation();
      if (!inputElemName || !inputElemVal) {
         return;
      }
      switch (inputElemName) {
         case "dateInputBox":
            this.onDateEntered(inputElemVal);
            break;

         case "timeRangeStart":
            this.onStartTimeEntered(inputElemVal);
            break;

         case "currentTimeInput":
            this.onCurrentTimeEntered(inputElemVal);
            break;
      }
   },

   onDateEntered(inputVal) {
      if (!inputVal) {
         return;
      }
      const selectedTimeObj = moment(inputVal + " " + this.currentTimeInput.value);
      if (this.checkDateInFuture(selectedTimeObj)) {
         this.setDateValue();
      }
      else {
         this.dateInput.value = selectedTimeObj.format("YYYY-MM-DD");
         this.applyAndUpdate(selectedTimeObj.unix(), true);
      }
   },

   onStartTimeEntered(inputVal) {
      if (!inputVal) {
         return;
      }
      const selectedTimeObj = moment(this.dateInput.value + " " + inputVal);
      if (this.checkDateInFuture(selectedTimeObj)) {
         this.setStartTimeValue();
      }
      else {
         const newTime = selectedTimeObj.unix();
         storage.timeRangeStart = newTime;
         if (newTime > storage.currentTime) {
            storage.currentTime = newTime;
         }
         this.applyAndUpdate(storage.currentTime);
      }
   },

   onCurrentTimeEntered(inputVal) {
      if (!inputVal) {
         return;
      }
      const selectedTimeObj = moment(this.dateInput.value + " " + inputVal);
      if (this.checkDateInFuture(selectedTimeObj)) {
         this.setCurrentTimeValue();
      }
      else {
         const newTime = selectedTimeObj.unix();
         if (newTime < storage.timeRangeStart) {
            storage.timeRangeStart = newTime;
         }
         this.applyAndUpdate(newTime);
      }
      splSrv.events.exec("onDateTimeChangeTriggerEvents");
   },

   checkDateInFuture(selectedTimeObj) {
      const liveDate = getLiveTime();
      if (selectedTimeObj.unix() > liveDate) {
         showSnackBar(splmap.tr("datepicker_date_in_future"));
         return true;
      }
      return false;
   }
};

