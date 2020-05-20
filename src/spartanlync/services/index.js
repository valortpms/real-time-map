/* eslint-disable one-var */
import splCfg from "../config";
import { InitSplAPI, InitSplSessionMgr } from "./api";
import { userInfo } from "../../dataStore/api-config";
import { showMsg } from "../ui-components";

const SpartanLyncServices = {

   debug: false,

   _api: null,
   sessionMgr: null,

   _credentials: {
      db: "",
      username: "",
      server: "",
      sessionId: "",
   },

   init: function () {
      const me = this;
      me.debug = splCfg.appEnv === "dev" ? true : false;

      me._credentials.db = userInfo.database;
      me._credentials.username = userInfo.userName;
      me._credentials.server = userInfo.server;
      me._credentials.sessionId = userInfo.sessionId;

      me._api = new InitSplAPI(splCfg.splApiUrl);
      me.sessionMgr = new InitSplSessionMgr(me._api, me._credentials);
   },

   checkForSplSession: function () {
      const me = this;
      me.sessionMgr.getSettings((remoteStore, dbDeviceIds) => {
         showMsg("remoteStore");
         console.log(remoteStore);
         showMsg("dbDeviceIds");
         console.log(dbDeviceIds);
      });
   },

};

/*
const SpartanLyncServices = {

   taskQueue: [],
   pollTime: 10000,
   running: false,
   schedulerHandle: null,

   testUrl: "virgin",

   init: function () {
      const me = this;
      console.log("SplServices().init()");
      console.log("testUrl = " + me.testUrl);
      me.testUrl = splCfg.splApiUrl;
   },

   setUrl: function (url) {
      const me = this;
      me.testUrl = url;
      console.log("utilityFunc(" + url + ") testUrl = " + me.testUrl);
   },

   utilityFunc: function (header) {
      const me = this;
      console.log("utilityFunc(" + header + ") testUrl = " + me.testUrl);
   },

   _currentTime: undefined,
   get currentTime() {
      console.log("get.currentTime() = " + this._currentTime);
      return this._currentTime;
   },
   set currentTime(currentTime) {
      this._currentTime = currentTime;
      console.log("set.currentTime() = " + this._currentTime);
   },

   add: function (func) {
      const me = this;
      if (typeof func !== "undefined" && func !== null && typeof func === 'function') {
         const args = Array.prototype.slice.call(arguments);
         args.shift();
         me.taskQueue.push({ f: func, a: args });
      }
      me.start();
   },

   run: function () {
      const me = this;
      if (me.taskQueue.length) {
         me.running = true;
         me.taskQueue.forEach(q => {
            const func = q.f,
               args = q.a;
            func.apply(func, args);
         });
         me.running = false;
      }
   },

   tick: function () {
      const me = this;
      if (me.schedulerHandle !== null) {
         if (!me.running) { me.run(); }
         me.schedulerHandle = setTimeout(function () {
            me.tick();
         }, me.pollTime);
      }
   },

   start: function () {
      const me = this;
      if (me.schedulerHandle === null) {
         me.schedulerHandle = setTimeout(function () {
            me.tick();
         }, me.pollTime);
      }
   },

   stop: function () {
      if (this.schedulerHandle !== null) {
         clearTimeout(this.schedulerHandle);
      }
      this.taskQueue = [];
      this.schedulerHandle = null;
   }
};

*/
export default SpartanLyncServices;