/* eslint-disable no-unused-vars */
import React from "react";
import { MapView } from "./components/map/map-view";
import { ControlsView } from "./components/controls/controls-component";
import { ConfigView } from "./components/configuration/configuration-view";
import ReactDOM from "react-dom";
import splSrvTools from "./spartanlync/services/tools";
import ReactTooltip from "react-tooltip";

class View extends React.Component {

   constructor(props) {
      super(props);
      splSrvTools.initServices();
   }

   componentDidMount() {
      splSrvTools.checkForSplTools();
   }

   render() {
      return (
         <div id="RTM-ViewContainer">
            < ConfigView />
            < MapView />
            < ControlsView />
            <ReactTooltip id="splTooltip" html={true} class="splPopupTooltip" getContent={(dataTip) => `${dataTip}`} />
         </div>
      );
   }
}

export function initView() {
   ReactDOM.render(<View />, document.getElementById("real-time-map-container"));
}
