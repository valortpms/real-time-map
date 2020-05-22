import React from "react";
import { MapView } from "./components/map/map-view";
import { ControlsView } from "./components/controls/controls-component";
import { ConfigView } from "./components/configuration/configuration-view";
import ReactDOM from "react-dom";
import splServices from "./spartanlync/services";

class View extends React.Component {

   constructor(props) {
      super(props);
      splServices.init();
   }

   componentDidMount() {
      splServices.checkForSplTools();
   }

   render() {
      return (
         <div id="RTM-ViewContainer">
            < ConfigView />
            < MapView />
            < ControlsView />
         </div>
      );
   }
}

export function initView() {
   ReactDOM.render(<View />, document.getElementById("real-time-map-container"));
}
