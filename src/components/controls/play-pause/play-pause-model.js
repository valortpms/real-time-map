import ReactTooltip from "react-tooltip";
import storage from "../../../dataStore/index";
import { SPACE_KEY } from "../../../constants/key-codes";

export const pausePlayModel = {
   playing: true,
   pausePlayIcon: undefined,

   initPausePlay() {
      storage.dateKeeper$.subscribe(this.updatePausePlay.bind(this));

      this.pausePlayIcon = document.getElementById("RTMControlButton");
      this.pausePlayIcon.classList.add("RTM-pauseIcon");
      this.pausePlayIcon.addEventListener("click", () => setTimeout(function () {
         ReactTooltip.hide(); // Clear Tooltip a few seconds after user clicks button
      }, 1000));
   },

   updatePausePlay() {
      if (this.playing === storage.dateKeeper$.paused) {
         this.playing = !this.playing;
         if (this.playing) {
            this.setPlayBackground();
         } else {
            this.setPausedBackground();
         }
      }
   },

   togglePausePlayKeyboardHandler(evt) {
      evt.preventDefault();
      if (evt.keyCode === SPACE_KEY) {
         this.togglePausePlay(); // On SPACE key, Toggle Pause/Play
      }
   },

   togglePausePlay() {
      if (this.playing) {
         this.setToPause();
      } else {
         this.setToPlay();
      }
   },

   setToPlay() {
      this.playing = true;
      this.setPlayBackground();
      storage.dateKeeper$.resume();
   },

   setToPause() {
      this.playing = false;
      this.setPausedBackground();
      storage.dateKeeper$.pause();
   },

   setPlayBackground() {
      this.pausePlayIcon.classList.remove("RTM-playIcon");
      this.pausePlayIcon.classList.add("RTM-pauseIcon");
      this.pausePlayIcon.setAttribute("data-tip", splmap.tr("splmap_controlspanel_tooltip_pause"));
   },

   setPausedBackground() {
      this.pausePlayIcon.classList.remove("RTM-pauseIcon");
      this.pausePlayIcon.classList.add("RTM-playIcon");
      this.pausePlayIcon.setAttribute("data-tip", splmap.tr("splmap_controlspanel_tooltip_play"));
   }
};
