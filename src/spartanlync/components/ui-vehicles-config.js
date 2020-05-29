// eslint-disable-next-line no-unused-vars
import React, { Component, Fragment } from "react";
import ReactTooltip from "react-tooltip";
import splSrv from "../services";
import splCfg from "../config";
import { fetchVehSensorDataAsync } from "../services/api/temptrac-tpms/utils";

/**
 *  Returns a Spl Sensor Data Button meant for a Vehicle List Item within Vehicle Configuration Panel
 *
 *  @returns JSX object
 */
export class SplSensorDataTypesButton extends Component {

   constructor(props) {
      super(props);

      this.onClickHandler = this.onClickHandler.bind(this);
      this.renderSplButton = this.renderSplButton.bind(this);

      this.state = {
         buttons: []
      };
      this.vehId = this.props.id;
      this.vehName = this.props.name.trim();
   }

   componentDidMount() {
      const me = this;

      // Prevent duplicate Initial Invocation(s)
      splCfg.shouldSplSensorDataButtonUpdate = false;
      setTimeout(() => {
         splCfg.shouldSplSensorDataButtonUpdate = true;
      }, 500);

      // Fetch SpartanLync Sensor Types installed into vehicle
      me.fetchSensorTypes(me.vehId, me.vehName);
   }

   // eslint-disable-next-line no-unused-vars
   shouldComponentUpdate(nextProps, nextState) {
      // Handler for preventing duplicate Initial Invocation(s)
      return splCfg.shouldSplSensorDataButtonUpdate;
   }

   /**
    * Fetch vehicle sensor data from API
    * Parse results and update state on sensor types in vehicle
    *
    *  @returns void
    */
   fetchSensorTypes() {
      const me = this;

      //Splunk for presence of sensor data types
      fetchVehSensorDataAsync(me.vehId)
         .then((sdata) => {
            me.setState(function (state) {
               if (Object.keys(sdata.temptrac).length) {
                  state.buttons.push("temptrac");
               }
               if (Object.keys(sdata.tpmspress).length || Object.keys(sdata.tpmstemp).length) {
                  state.buttons.push("tpms");
               }
               return {
                  buttons: state.buttons
               };
            });
         })
         .catch((reason) => {
            if (reason === "No Sensors Found") {
               console.log("---- NO SENSORS FOUND for Vehicle '", me.vehName, "'");
            }
         });
   }

   /**
    * Click Handler, invoked once there are sensor types to display
    *
    *  @returns void
    */
   onClickHandler() {
      const me = this;
      console.log("Click Vehicle Button for" +
         " VehicleId = ", me.vehId,
         " VehicleName = ", me.vehName,
         " ButtonTypes = ", me.state.buttons
      );
   }

   /**
    * Renders Temptrac or TPMS button for UI
    *
    *  @returns JSX
    */
   renderSplButton(type) {
      return (
         <div className={`spl-vehicle-config-list-item-button ${type}`} key={type}>
            {type === "temptrac" ? "Temptrac" : "TPMS"}
         </div>
      );
   }

   render() {
      const me = this;
      const sensorBtnHandleClass = me.state.buttons.length ?
         (me.state.buttons.length > 1 ?
            "both-sensors" : "") : "hidden";

      if (me.state.buttons.length) {
         setTimeout(() => {
            ReactTooltip.rebuild();
         }, 1000);
      }
      return (
         <Fragment>
            <span
               className="spl-vehicle-config-list-item-wrapper"
               {...(me.state.buttons.length && {
                  "onClick": me.onClickHandler,
                  "data-tip": "View SpartanLync Sensor Data for this Vehicle",
                  "data-for": "splTooltip"
               })}>
               {me.state.buttons.length ? me.state.buttons.map(type => me.renderSplButton(type)) : ""}
            </span >
            <span className={`btn-handle ${sensorBtnHandleClass}`}></span>
         </Fragment>
      );
   }
};