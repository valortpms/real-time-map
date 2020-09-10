
/**
 * Version 1.3
 *
 * InitSecurityClearanceAPI() Library to process Geotab security clearance groups
 * and (1) loading a specifed user using the constructor or (2) reloading a new user using the public method
 *     - init( userObject )
 *
 * and provide public utility methods for validating a specified user by
 *     - userIs( group )
 *     - userInheritsFrom( group )
 *     - userHasFilter( filter )
 *
 * Additionally, an array of groups and filters can be retrieved
 *     - getGroups()
 *     - getGroupsInheritedFrom( group )
 *     - getAllFilters()
 *
 * Finally, a callback invoked upon Library initialization can be
 * - specified in the constructor
 * or
 * - using the method addOnLoadHandler(callback)
 *
 * @param {object} myapi - Geotab api object as supplied by api.js or in an add-in context
 * @param {object} user  - Geotab User object returned by a Get.User call
 * @param {function} callbackWhenComplete - Callback handler invoked when processing is complete
 *
 * @return {object} Instance to this library
 */
export const InitSecurityClearanceAPI = function InitSecurityClearanceAPI(myapi, user, callbackWhenComplete) {
   const me = this; // required from within methods used as callbacks

   // private variables & methods
   this._defGrpNames = {
      GroupSecurityId: "ROOT",
      GroupEverythingSecurityId: "Administrator",
      GroupUserSecurityId: "Default user",
      GroupDriveUserSecurityId: "Drive App user",
      GroupNothingSecurityId: "Nothing",
      GroupSupervisorSecurityId: "Supervisor",
      GroupViewOnlySecurityId: "View only"
   };
   this._callbackWhenComplete = null;
   this._userGrps = [];
   this._inheritance = [];
   this._geotabGroups = null;
   this._secGrps = {
      keys: []
   };

   /**
    * getGroups() get array of human readable groups names (default and custom) in Geotab database
    * @return {Array} Name of each Geotab security group, in human readable format
    */
   this.getGroups = function () {
      const me = this;
      const secGrps = me._secGrps;
      const groupArr = [];

      secGrps.keys.map(function (grpId) {
         if (secGrps[grpId].level) {
            groupArr.push({
               name: secGrps[grpId].name,
               order: secGrps[grpId].level
            });
         }
      });
      groupArr.sort(me.orderSort);
      return Object.keys(groupArr).map(function (key) {
         return groupArr[key].name;
      });
   };

   /**
    * getGroupsInheritedFrom() get array of human readable groups names (default and custom) in Geotab database inherited from supplied group name
    * @param {string} name - Case-insensitive camel case name of Security Clearance group
    *                        Allowed Default values are (case-insensitive):
    *                            - Administrator
    *                            - Supervisor
    *                            - DefaultUser
    *                            - DriveAppUser
    *                            - ViewOnly
    *                            - Nothing
    *                            - A camel-case version of any custom clearance group
    * @return {Array} Sorted names, in human readable format, of Geotab security groups inhertied from the supplied group name
    */
   this.getGroupsInheritedFrom = function (name) {
      const me = this;
      const secGrps = me._secGrps;
      const geotabGroups = me._geotabGroups;
      const grpArr = [];

      for (let i = 0; i < geotabGroups.length; i++) {
         const sourceGrp = geotabGroups[i];
         const sourceName = secGrps[sourceGrp.id].name;
         if (name.toLowerCase() === me.camelize(sourceName).toLowerCase()) {
            grpArr = me.groupWalkerArr(sourceGrp);
            break;
         }
      }
      return grpArr.sort();
   };

   /**
    * getAllFilters() get sorted array of all Filters names in Geotab database
    * @return {Array} Name of each Geotab security filter
    */
   this.getAllFilters = function () {
      const me = this;
      const secGrps = me._secGrps;
      return secGrps["GroupSecurityId"].filters.get().sort(); // eslint-disable-line dot-notation
   };

   /**
    * userHasFilter() Use this function to verify is user is assigned to a specified security clearance group defined in that database
    * @param {string} fname - Case-insensitive camel case name of Security Clearance group
    *                         Allowed Default values are (case-insensitive):
    *                            - Administrator
    *                            - Supervisor
    *                            - DefaultUser
    *                            - DriveAppUser
    *                            - ViewOnly
    *                            - Nothing
    *                            - A camel-case version of any custom clearance group
    * @return {Boolean} true is User is in this group, otherwise false
    */
   this.userHasFilter = function (fname) {
      const me = this;
      const secGrps = me._secGrps;
      const userGrps = me._userGrps;
      const isFound = false;

      if (typeof fname !== "undefined" && typeof fname === "string") {
         userGrps.map(function (userGrp) {
            const secGrp = secGrps[userGrp];
            if (secGrp.filters.exists(fname)) {
               isFound = true;
               return;
            }
         });
      }
      return isFound;
   };

   /**
    * userIs() Use this function to verify is user is assigned to a specified security clearance group defined in that database
    * @param {string} name - Case-insensitive camel case name of Security Clearance group
    *                        Allowed Default values are (case-insensitive):
    *                            - Administrator
    *                            - Supervisor
    *                            - DefaultUser
    *                            - DriveAppUser
    *                            - ViewOnly
    *                            - Nothing
    *                            - A camel-case version of any custom clearance group
    * @return {Boolean} true is User is in this group, otherwise false
    */
   this.userIs = function (name) {
      const me = this;
      const userGrps = me._userGrps;
      const secGrps = me._secGrps;
      const lookingFor = "";
      const isFound = false;

      for (const gname in secGrps) {
         if (secGrps.hasOwnProperty(gname)) {
            if (gname === "GroupSecurityId" || gname === "keys") {
               continue;
            }
            const gvalue = secGrps[gname].name;
            if (name.toLowerCase() === me.camelize(gvalue).toLowerCase()) {
               lookingFor = gname;
            }
         }
      }
      userGrps.map(function (grp) {
         if (grp === lookingFor) {
            isFound = true;
            return;
         }
      });
      return isFound;
   };

   /**
    * userInheritsFrom() Use this function to verify is user is assigned to a specified security clearance group defined in that database
    * @param {string} name - Case-insensitive camel case name of Security Clearance group to check if user's current group inherits from specified name
    *                        Allowed Default values are (case-insensitive):
    *                            - Administrator
    *                            - Supervisor
    *                            - DefaultUser
    *                            - DriveAppUser
    *                            - ViewOnly
    *                            - Nothing
    *                            - A camel-case version of any custom clearance group
    * @return {Boolean} true is User inherits from this group, otherwise false
    */
   this.userInheritsFrom = function (name) {
      const me = this;
      const userGrps = me._userGrps;
      const secGrps = me._secGrps;
      const geotabGroups = me._geotabGroups;

      if (geotabGroups && geotabGroups.length) {
         for (let i = 0; i < geotabGroups.length; i++) {
            const sourceGrp = geotabGroups[i];
            const sourceName = secGrps[sourceGrp.id].name;
            if (name.toLowerCase() === me.camelize(sourceName).toLowerCase()) {
               for (let j = 0; j < userGrps.length; j++) {
                  const targetGrpId = userGrps[j];
                  if (me.groupWalker(sourceGrp, targetGrpId)) {
                     return true;
                  }
               }
            }
         }
      }
      return false;
   };

   /**
    * addOnLoadHandler() Add a handler that will be called when processing is complete
    * @param {function} handler - Reference to callback added to queue of functions to invoked when processing is completed
    */
   this.addOnLoadHandler = function (handler) {
      if (typeof handler !== "undefined" && typeof handler === "function") {
         me.taskMgr.registerCallback(handler);
      }
   };

   /**
    *
    * === NOTHING TO SEE BELOW - Private Methods =======================================================================
    *
    */

   /**
    * orderSort() Sort Function
    * @param {string} a - 1st comparative element
    * @param {string} b - 2nd comparative element
    */
   this.orderSort = function (a, b) {
      if (a.order < b.order) {
         return -1;
      }
      if (a.order > b.order) {
         return 1;
      }
      return 0;
   };

   this.groupWalker = function (sourceGrp, targetGrpId) {
      const me = this;
      const defGrpNames = me._defGrpNames;
      const geotabGroups = me._geotabGroups;

      if (targetGrpId === sourceGrp.id) {
         return true;
      }
      // Recursively go looking in children groups
      for (let i = 0; i < sourceGrp.children.length; i++) {
         const childGrpId = sourceGrp.children[i].id;
         if (typeof defGrpNames[childGrpId] !== "undefined") {
            continue;
         }
         for (let j = 0; j < geotabGroups.length; j++) {
            if (geotabGroups[j].id === childGrpId) {
               if (me.groupWalker(geotabGroups[j], targetGrpId)) {
                  return true;
               } else {
                  break;
               }
            }
         }
      }
      return false;
   };

   this.groupWalkerArr = function (sourceGrp, grpArr) {
      const me = this;
      const secGrps = me._secGrps;
      const defGrpNames = me._defGrpNames;
      const geotabGroups = me._geotabGroups;

      if (typeof grpArr === "undefined") {
         grpArr = [];
      }
      // Recursively go looking in children groups
      for (let i = 0; i < sourceGrp.children.length; i++) {
         const childGrpId = sourceGrp.children[i].id;
         if (typeof defGrpNames[childGrpId] !== "undefined") {
            continue;
         }

         grpArr.push(secGrps[childGrpId].name);
         for (let j = 0; j < geotabGroups.length; j++) {
            if (geotabGroups[j].id === childGrpId) {
               grpArr = me.groupWalkerArr(geotabGroups[j], grpArr);
               break;
            }
         }
      }
      return grpArr;
   };

   this.taskMgr = function () {
      const me = {
         _taskCounter: 0,
         _taskDoneCallbacks: [],

         taskStart: function taskStart() {
            me._taskCounter++;
         },

         taskDone: function taskDone() {
            me._taskCounter--;
            if (me._taskCounter === 0) {
               me.launchCallbacksWhenDone();
            }
         },

         launchCallbacksWhenDone: function launchCallbacksWhenDone() {
            if (me.totalTasks() === 0 && me.totalCallbacks()) {
               for (let i = 0; i < me._taskDoneCallbacks.length; i++) {
                  me._taskDoneCallbacks[i]();
               }
               me._taskDoneCallbacks = [];
            }
         },

         registerCallback: function registerCallback(callback) {
            if (typeof callback !== "undefined" && typeof callback === "function") {
               me._taskDoneCallbacks.push(callback);
            }
         },

         totalTasks: function totalTasks() {
            return me._taskCounter;
         },

         totalCallbacks: function totalCallbacks() {
            return me._taskDoneCallbacks.length;
         }
      };
      return me;
   }();

   this.camelize = function (str) {
      return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (letter, index) {
         return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
      }).replace(/\s+/g, "");
   };

   this.InitFilterAPI = function () {
      this._filter = {
         keys: []
      };

      this.add = function (fname) {
         const me = this;
         const filter = me._filter;
         if (typeof fname !== "undefined" && typeof fname === "string" && typeof filter[fname] === "undefined") {
            filter[fname] = true;
            filter.keys.push(fname);
         }
      };

      this.del = function (fname) {
         const me = this;
         const filter = me._filter;
         if (typeof fname !== "undefined" && typeof fname === "string" && typeof filter[fname] !== "undefined") {
            delete filter[fname];
            for (let i = 0; i < filter.keys.length; i++) {
               if (filter.keys[i] === fname) {
                  filter.keys.splice(i, 1);
               }
            }
         }
      };

      this.get = function () {
         const me = this;
         const filter = me._filter;
         const keys = filter.keys;
         keys.sort(function (a, b) {
            return a.toLowerCase().localeCompare(b.toLowerCase());
         }); // eslint-disable-line semi-spacing
         return keys;
      };

      this.clear = function () {
         const me = this;
         me._filter = {
            keys: []
         };
      };

      this.exists = function (fname) {
         const me = this;
         const filter = me._filter;
         if (typeof fname !== "undefined" && typeof fname === "string" && typeof filter[fname] !== "undefined") {
            return true;
         }
         return false;
      };

      this.importFromGeotab = function (fArr) {
         const me = this;
         if (typeof fArr !== "undefined" && fArr.length) {
            fArr.map(function (f) {
               if (f.isAdd === true) {
                  if (f.securityIdentifier !== "Everything") {
                     me.add(f.securityIdentifier);
                  }
               } else {
                  if (f.securityIdentifier === "Everything") {
                     me.clear();
                  } else {
                     me.del(f.securityIdentifier);
                  }
               }
            });
         }
      };

      this.inherit = function (parent) {
         const me = this;
         parent.get().map(function (f) {
            me.add(f);
         });
      };
   };

   this.processUser = function (userSecObj) {
      const me = this;
      const userGrps = me._userGrps;

      if (typeof userSecObj !== "undefined") {
         if (userSecObj.id) {
            userGrps.push(userSecObj.id);
            userSecObj.children.map(function (childUserObj) {
               me.processUser(childUserObj);
            });
         } else if (userSecObj.length) {
            userSecObj.map(function (secGroup) {
               me.processUser(secGroup);
            });
         }
      }
      return null;
   };

   this.fetchGroups = function (callback) {
      const me = this;
      myapi.call("Get", {
         typeName: "Group",
         search: {
            id: "GroupSecurityId"
         }
      }, function (result) {
         if (result && result.length) {
            me._geotabGroups = result;
            if (typeof callback !== "undefined" && typeof callback === "function") {
               callback();
            }
         }
      }, function (errorString) {
         console.log("--- Error: InitSecurityClearanceAPI.fetchGroups(): " + errorString);
      });
   };

   this.processGroups = function () {
      const secGrps = me._secGrps;
      const geotabGroups = me._geotabGroups;

      // Setup Group datastructures
      geotabGroups.map(function (grp) {
         secGrps[grp.id] = {
            name: me._defGrpNames[grp.id] ? me._defGrpNames[grp.id] : grp.name,
            level: 0,
            filters: new me.InitFilterAPI()
         };
         secGrps.keys.push(grp.id);
      });

      // Recursively walk the children, to generate Security filters for each group
      me.fetchFilters(geotabGroups[0]);
      me.taskMgr.taskDone();
   };

   this.fetchFilters = function (geotabGroupObj, parentId, hierarchy) {
      const secGrps = me._secGrps;
      const myGrp = secGrps[geotabGroupObj.id];

      // Child has higher hierarchy number than parent, use this for sorting
      if (typeof hierarchy !== "undefined") {
         myGrp.level = hierarchy + 1;
      }

      // Import filters from parent
      if (typeof parentId !== "undefined") {
         myGrp.filters.inherit(secGrps[parentId].filters);
      }
      // Modify this group's imported filters, with changes for this group
      myGrp.filters.importFromGeotab(geotabGroupObj.securityFilters);

      // Recursively populate children filters
      geotabGroupObj.children.map(function (childGrp) {
         for (let i = 0; i < me._geotabGroups.length; i++) {
            if (me._geotabGroups[i].id === childGrp.id) {
               me.fetchFilters(me._geotabGroups[i], geotabGroupObj.id, myGrp.level);
            }
         }
      });

      return null;
   };

   this.init = function (userObj) {
      const me = this;
      if (typeof userObj === "undefined" || me.taskMgr.totalTasks()) {
         return;
      }
      me._userGrps = [];
      me._geotabGroups = null;
      me._secGrps = {
         keys: []
      };

      if (me._callbackWhenComplete !== null) {
         me.taskMgr.registerCallback(me._callbackWhenComplete);
      }
      me.taskMgr.taskStart();

      me.processUser(userObj.securityGroups);
      me.fetchGroups(me.processGroups);
   };

   this.configure = function (userObj, callback) {
      const me = this;

      if (typeof callback !== "undefined" && typeof callback === "function") {
         me._callbackWhenComplete = callback;
      }
      me.init(userObj);
   };

   // configure when an instance gets created
   this.configure(user, callbackWhenComplete);
};