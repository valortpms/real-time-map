import storage from "../../../dataStore";
import ReactTooltip from "react-tooltip";

export const initCollapse = () => {
   const coll = document.getElementsByClassName("collapsible");

   coll[0].addEventListener("click", function () {

      this.classList.toggle("active");
      const content = document.getElementById("RTM-config-container");
      const map = document.getElementById("RTM-Map");
      const button = document.getElementById("collapse-button");

      if (content.style.maxWidth === "100%") {
         //button.title = "Open Configuration Panel";
         button.setAttribute("data-tip", "Open Configuration Panel");
         button.classList.remove("closeConfigPanel");
         button.classList.add("openConfigPanel");
         content.style.maxWidth = "0%";
         map.style.maxWidth = "100%";
      }
      else {
         //button.title = "Collapse Configuration Panel";
         button.setAttribute("data-tip", "Close Configuration Panel");
         button.classList.remove("openConfigPanel");
         button.classList.add("closeConfigPanel");
         content.style.maxWidth = "100%";
         map.style.maxWidth = "75%";
      }

      ReactTooltip.rebuild();
      storage.map.invalidateSize(true);
   });
};
