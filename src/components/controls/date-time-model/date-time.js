import storage from "../../../dataStore";
import { getLiveTime } from "../../../utils/helper";
import { showSnackBar } from "../../snackbar/snackbar";
import splSrv from "../../../spartanlync/services";

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

   get controlBarObj() {
      return document.getElementById("RTM-ControlBarContainer");
   },

   initDateTimeInput() {

      this.setDefaultDateValue();
      this.setDefaultStartTimeValue();
      this.setDefaultCurrentTimeValue();

      this.dateInput.addEventListener("change", this.onChangeSaveDateTimeInput.bind(this));
      this.startTimeInput.addEventListener("change", this.onChangeSaveDateTimeInput.bind(this));
      this.currentTimeInput.addEventListener("change", this.onChangeSaveDateTimeInput.bind(this));

      for (const applyBtn of this.applyBtns) {
         applyBtn.addEventListener("click", this.onApplyBtnClicked.bind(this));
      }
      storage.dateKeeper$.subscribe(this.updateCurrentSecond.bind(this));
   },

   setDefaultDateValue() {
      this.dateInput.value = new Date(storage.currentTime).toLocaleDateString("en-CA");
      this.clearApplyBtn(this.dateInput);
   },

   setDefaultStartTimeValue() {
      this.startTimeInput.value = new Date(storage.timeRangeStart).toLocaleTimeString("en-GB");
      this.clearApplyBtn(this.startTimeInput);
   },

   setDefaultCurrentTimeValue() {
      this.currentTimeInput.value = new Date(storage.currentTime).toLocaleTimeString("en-GB");
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

   updateCurrentSecond(currentSecond) {

      if (this.dateInput && document.activeElement !== this.dateInput) {
         this.setDefaultDateValue();
      }

      if (this.startTimeInput && document.activeElement !== this.startTimeInput) {
         this.setDefaultStartTimeValue();
      }

      if (this.currentTimeInput && document.activeElement !== this.currentTimeInput) {
         this.currentTimeInput.value = new Date(currentSecond).toLocaleTimeString("en-GB");
         this.clearApplyBtn(this.currentTimeInput);
      }
   },

   applyAndUpdate(newTime, disableTimeControls) {
      if (typeof disableTimeControls !== "undefined" && disableTimeControls) {
         this.disableTimeControls();
         splSrv.events.register("onDateUpdate", () => this.enableTimeControls());
      }
      this.updateCurrentSecond(newTime);
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
      const selectedTime = new Date(inputVal + " " + this.currentTimeInput.value);

      if (this.checkDateInFuture(selectedTime)) {
         this.setDefaultDateValue();
      }
      else {
         this.dateInput.value = selectedTime.toLocaleDateString("en-CA");
         this.applyAndUpdate(selectedTime.getTime(), true);
      }
   },

   onStartTimeEntered(inputVal) {
      if (!inputVal) {
         return;
      }
      const selectedTime = new Date(this.dateInput.value + " " + inputVal);

      if (this.checkDateInFuture(selectedTime)) {
         this.setDefaultStartTimeValue();
      }
      else {
         const newTime = selectedTime.getTime();
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
      const selectedTime = new Date(this.dateInput.value + " " + inputVal);

      if (this.checkDateInFuture(selectedTime)) {
         this.setDefaultCurrentTimeValue();
      }
      else {
         const newTime = selectedTime.getTime();
         if (newTime < storage.timeRangeStart) {
            storage.timeRangeStart = newTime;
         }
         this.applyAndUpdate(newTime);
      }
   },

   checkDateInFuture(selectedTime) {
      const liveDate = new Date(getLiveTime());
      if (selectedTime > liveDate) {
         showSnackBar(splmap.tr("datepicker_date_in_future"));
         return true;
      }
      return false;
   }
};

