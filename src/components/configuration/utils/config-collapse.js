import storage from "../../../dataStore";
import ReactTooltip from "react-tooltip";

export const initCollapse = () => {
   const coll = document.getElementsByClassName("collapsible");

   coll[0].addEventListener("click", function () {

      this.classList.toggle("active");
      const content = document.getElementById("RTM-config-container");
      const map = document.getElementById("RTM-Map");
      const button = document.getElementById("collapse-button");

      if (content.classList.contains("panel-open")) {
         button.setAttribute("data-tip", splmap.tr("splmap_tooltip_configpanel_open"));
         button.classList.remove("closeConfigPanel");
         button.classList.add("openConfigPanel");
         content.classList.remove("panel-open");
         map.classList.remove("panel-open");
      }
      else {
         button.setAttribute("data-tip", splmap.tr("splmap_tooltip_configpanel_close"));
         button.classList.remove("openConfigPanel");
         button.classList.add("closeConfigPanel");
         content.classList.add("panel-open");
         map.classList.add("panel-open");
      }

      ReactTooltip.rebuild();
      storage.map.invalidateSize(true);
   });
};
