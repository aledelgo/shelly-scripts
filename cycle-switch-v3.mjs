/***
 * V3.0 - 20/07/2023
 * This script loaded in a shelly 2 PM can act as an advanced cycle switch.
 * 
 * Additional features compared to the base script on the original repository
 * (https://github.com/ALLTERCO/shelly-script-examples/blob/main/cycle-switch.js)
 * 
 * - can manage 2 output for cycle iteration
 * - can detect the current iteration also if single outputs are managed form external app (like shelly, API etc).
 * - if you configure restoration of last output state after powerloss,
 * the script can detect and restore the last cycle, so when you push button again the iteration continues from last state.
 */

/// <reference path="../../shelly-script.d.ts" />
let CONFIG = {
  /**
   * Pick your desired Input to be used for triggering the cycling (note: this input would be changed
   * to detached!)
   */
  INPUT_ID: 0,

  /**
   * List (in the expected order) the operations that you want this script to cycle through.
   * E.g. [switchId, "on" or "off"]
   */
  CYCLES: [
    [0, true, 1, true],
    [0, true, 1, false],
    [0, false, 1, true],
    [0, false, 1, false],
  ],

  LONG_PUSH_CYCLE_INDEX: 3


};

let STARTUP = {
  s0: false,
  s1: false,
};

let disableReadOutput = 0;

let currentCycle = -1;

let runCycle = function (cycleIndex) {
  if (cycleIndex >= 0) {
    currentCycle = cycleIndex;
  } else {
    currentCycle++;
  }


  let currentOperation = CONFIG.CYCLES[currentCycle];
  if (!currentOperation) {
    currentCycle = 0;
    currentOperation = CONFIG.CYCLES[currentCycle];
  }

  print("setting cycle:");
  print(currentCycle);
  print(JSON.stringify(currentOperation));

  disableReadOutput++;


  Shelly.call("switch.set", {
    id: JSON.stringify(currentOperation[0]),
    on: currentOperation[1],
  },
    function (status, error_code, error_message, userdata) {
      disableReadOutput--;
    }

  );

  //support cycle array with 2 output at same time
  if (currentOperation.length >= 4) {
    disableReadOutput++;
    Shelly.call("switch.set",
      {
        id: JSON.stringify(currentOperation[2]),
        on: currentOperation[3],
      },
      function (status, error_code, error_message) {
        disableReadOutput--;
      });
  }


};

let readOuput = function (callback) {

  if (disableReadOutput) {
    return;
  }

  Shelly.call(
    "switch.getstatus",
    { id: 0 },
    function (status, error_code, error_message) {
      STARTUP.s0 = status.output;
      print(JSON.stringify(status));


      print("startup 1/2: " + JSON.stringify(STARTUP));


      Shelly.call(
        "switch.getstatus",
        { id: 1 },
        function (status, error_code, error_message) {
          STARTUP.s1 = status.output;

          print(JSON.stringify(status));

          print("startup 2/2: " + JSON.stringify(STARTUP));

          //detect current cycle
          for (let index = 0; index < CONFIG.CYCLES.length; index++) {
            let element = CONFIG.CYCLES[index];
            //print ("a");
            if (element[0] === 0 && element[1] === STARTUP.s0) {
              //noop
            } else if (element[0] === 1 && element[1] === STARTUP.s1) {
              //noop 
            } else {
              continue;
            }
            //print ("b");
            if (element.length >= 4) {
              if (element[2] === 0 && element[3] === STARTUP.s0) {
                //noop
              } else if (element[2] === 1 && element[3] === STARTUP.s1) {
                //noop 
              } else {
                continue;
              }
            }
            //print ("c");
            currentCycle = index;
            print("current cycle detected: ");
            print(currentCycle);

            if (typeof (this.callback) === "function") {
              this.callback();
            }


          }


        }
      );
    }
  );

};

let setup = function () {


  Shelly.call(
    "switch.setconfig",
    { id: JSON.stringify(CONFIG.INPUT_ID), config: { in_mode: "detached" } },
    function () {


      Shelly.addEventHandler(function (event, user_data) {
        if (event.component === "input:" + JSON.stringify(CONFIG.INPUT_ID)) {
          if (
            event.info.state !== false &&
            event.info.event !== "btn_up" &&
            event.info.event !== "btn_down" &&
            event.info.event !== "long_push"
          ) {
            runCycle();
          } else if (event.info.event === 'long_push') {
            print("LONG PUSH!");
            runCycle(CONFIG.LONG_PUSH_CYCLE_INDEX);
          }
        }


      }, null);

      Shelly.addStatusHandler(function (e) {

        print(JSON.stringify(e));

        if (e.component === "switch:0" || e.component === "switch:1") {

          if (typeof (e.delta.output) !== "undefined") {
            readOuput();
          }
        }

      });


    }

  );

  readOuput(runCycle);
};

setup();