// eslint-disable-next-line no-unused-vars
import React, { Component } from "react";
import splSrv from "../services";
import prodSplCfg from "../config/prod";

/**
 *  Renders a SpartanLync Logo Icon meant to show SplMap meta-data
 *
 *  @returns JSX object
 */
export class SplLogo extends Component {

   constructor(props) {
      super(props);

      this.buildUrlAttempt = 0;
      this.state = {
         buildVersion: "",
         buildDateUnix: null,

         spltoolsTimezone: "",
         spltoolsLang: "",
         spltoolsSensorInfoRefreshRate: 0,
      };

      this.fetchSettings = this.fetchSettings.bind(this);
   }

   componentDidMount() {
      const me = this;

      // Register a callback, invoked when SplTools is successfully initialized
      splSrv.events.register("onLoadSplServices", me.fetchSettings, false);

      // Get build info from Backend server
      me.fetchBuildDate((metadataTxt) => {
         const [appVer, unixTimestamp] = metadataTxt.trim().split("\n");
         if (appVer && !isNaN(unixTimestamp)) {
            me.setState({
               buildVersion: appVer,
               buildDateUnix: unixTimestamp
            });
         }
      });
   }

   fetchBuildDate(callback) {
      const me = this;
      const buildUrl = me.getBuildUrl();
      if (buildUrl) {
         fetch(buildUrl)
            .then(response => response.text())
            .then(data => callback(data))
            // eslint-disable-next-line no-unused-vars
            .catch(err => me.fetchBuildDate(callback));  //console.log("---- Failed to Load URL ", buildUrl, " Error: ", err.stack)
      }
      else {
         console.log("-------- SplLogo: Failed to load " + splSrv.buildMetadataFilename + "! GIVING UP!! --------");
      }
   }

   fetchSettings() {
      const me = this;
      me.setState({
         spltoolsTimezone: splSrv.splStore.timezone,
         spltoolsLang: splSrv.splStore.lang,
         spltoolsSensorInfoRefreshRate: splSrv.splStore.sensorInfoRefreshRate,
      });
   }

   getBuildUrl() {
      const me = this;
      me.buildUrlAttempt++;
      switch (me.buildUrlAttempt) {
         case 1:
            return prodSplCfg.splApiUrl.replace("/api/", "/splmap.dev/" + splSrv.buildMetadataFilename);
            break;

         case 2:
            return prodSplCfg.splApiUrl.replace("/api/", "/splmap.staging/" + splSrv.buildMetadataFilename);
            break;

         case 3:
            return prodSplCfg.splApiUrl.replace("/api/", "/splmap/" + splSrv.buildMetadataFilename);
            break;

         default:
            return null;
      }
   }

   render() {
      const timezone = this.state.spltoolsTimezone ? this.state.spltoolsTimezone : "UnKnown";
      const lang = this.state.spltoolsLang ? splSrv.splLanguages[this.state.spltoolsLang] : "UnKnown";
      const sensorInfoRefreshRate = this.state.spltoolsSensorInfoRefreshRate ? this.state.spltoolsSensorInfoRefreshRate : null;
      const buildVersion = this.state.buildVersion ? this.state.buildVersion : "UnKnown";
      let buildDateHuman = this.state.buildDateUnix ? splSrv.convertUnixToTzHuman(this.state.buildDateUnix) : "UnKnown";
      buildDateHuman = buildDateHuman ? buildDateHuman : "UnKnown";

      return (
         <span className="spl-watermark">
            <div>
               <label>{this.props["app-name"]}</label>
               <div>
                  <strong>Date & Time Timezone:</strong>
                  <span>{timezone}</span>
                  <strong>Sensor Info Refresh Rate:</strong>
                  <span>{sensorInfoRefreshRate ? (sensorInfoRefreshRate / 60) + " min" : "UnKnown"}</span>
                  <strong>Language:</strong>
                  <span dangerouslySetInnerHTML={{ __html: lang }}></span>
                  <br />
                  <strong>Build Version:</strong>
                  <span>{buildVersion}</span>
                  <strong>Build Date:</strong>
                  <span>{buildDateHuman}</span>
               </div>
            </div>
         </span>
      );
   }
};