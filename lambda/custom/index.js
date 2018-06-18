/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require("ask-sdk-core");
const AWS = require("aws-sdk");

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "LaunchRequest";
  },
  handle(handlerInput) {
    const speechText =
      "Hello, welcome to the Active Office Alexa protocol plugin. If you would like to create a new exercise routine, just say so.";

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(
        "If would you like to create a new exercise routine just say so."
      )
      .getResponse();
  }
};

const InProgressCreateRoutineHandler = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return (
      request.type === "IntentRequest" &&
      request.intent.name === "CreateRoutine" &&
      request.dialogState !== "COMPLETED"
    );
  },

  handle(handlerInput) {
    const currentIntent = handlerInput.requestEnvelope.request.intent;
    let prompt = "";

    for (const slotName of Object.keys(
      handlerInput.requestEnvelope.request.intent.slots
    )) {
      const currentSlot = currentIntent.slots[slotName];
      if (
        currentSlot.confirmationStatus !== "CONFIRMED" &&
        currentSlot.resolutions &&
        currentSlot.resolutions.resolutionsPerAuthority[0]
      ) {
        if (
          currentSlot.resolutions.resolutionsPerAuthority[0].status.code ===
          "ER_SUCCESS_MATCH"
        ) {
          if (
            currentSlot.resolutions.resolutionsPerAuthority[0].values.length > 1
          ) {
            prompt = "Which would you like";
            const size =
              currentSlot.resolutions.resolutionsPerAuthority[0].values.length;

            currentSlot.resolutions.resolutionsPerAuthority[0].values.forEach(
              (element, index) => {
                prompt += ` ${index === size - 1 ? " or" : " "} ${
                  element.value.name
                }`;
              }
            );

            prompt += "?";

            return handlerInput.responseBuilder
              .speak(prompt)
              .reprompt(prompt)
              .addElicitSlotDirective(currentSlot.name)
              .getResponse();
          }
        } else if (
          currentSlot.resolutions.resolutionsPerAuthority[0].status.code ===
          "ER_SUCCESS_NO_MATCH"
        ) {
          return handlerInput.responseBuilder
            .speak("Error")
            .reprompt("Error")
            .addElicitSlotDirective(currentSlot.name)
            .getResponse();
        }
      }
    }

    return handlerInput.responseBuilder
      .addDelegateDirective(currentIntent)
      .getResponse();
  }
};

const CompletedCreateRoutineHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;

    return (
      request.type === "IntentRequest" &&
      request.intent.name === "CreateRoutine" &&
      request.dialogState === "COMPLETED"
    );
  },

  handle(handlerInput) {
    return new Promise((res, rej) => {
      const filledSlots = handlerInput.requestEnvelope.request.intent.slots;

      const slotValues = getSlotValues(filledSlots);

      const saveParams = {
        TableName: "activeOfficeRoutines",
        Item: {
          userId: handlerInput.requestEnvelope.session.user.userId,
          startDate: slotValues.createDate.resolved,
          startTime: slotValues.createTime.resolved,
          setCount: slotValues.createCount.resolved,
          setInterval: slotValues.createDuration.resolved
        }
      };

      dynamoDB.put(saveParams, err => {
        if (err) {
          rej(err);
        }

        const speechOutput = "Fantastic, I have saved your routine for you.";

        res(handlerInput.responseBuilder.speak(speechOutput).getResponse());
      });
    });
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speechText = "You can say hello to me!";

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard("Hello World", speechText)
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      (handlerInput.requestEnvelope.request.intent.name ===
        "AMAZON.CancelIntent" ||
        handlerInput.requestEnvelope.request.intent.name ===
          "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    const speechText = "Goodbye!";

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard("Hello World", speechText)
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "SessionEndedRequest";
  },
  handle(handlerInput) {
    console.log(
      `Session ended with reason: ${
        handlerInput.requestEnvelope.request.reason
      }`
    );

    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak("Sorry, I can't understand the command. Please say again.")
      .reprompt("Sorry, I can't understand the command. Please say again.")
      .getResponse();
  }
};

// Helper function
function getSlotValues(filledSlots) {
  const slotValues = {};

  console.log(`The filled slots: ${JSON.stringify(filledSlots)}`);
  Object.keys(filledSlots).forEach(item => {
    const name = filledSlots[item].name;

    if (
      filledSlots[item] &&
      filledSlots[item].resolutions &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0] &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code
    ) {
      switch (
        filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code
      ) {
      case "ER_SUCCESS_MATCH":
        slotValues[name] = {
          synonym: filledSlots[item].value,
          resolved:
              filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0]
                .value.name,
          isValidated: true
        };
        break;
      case "ER_SUCCESS_NO_MATCH":
        slotValues[name] = {
          synonym: filledSlots[item].value,
          resolved: filledSlots[item].value,
          isValidated: false
        };
        break;
      default:
        break;
      }
    } else {
      slotValues[name] = {
        synonym: filledSlots[item].value,
        resolved: filledSlots[item].value,
        isValidated: false
      };
    }
  }, this);

  return slotValues;
}

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    InProgressCreateRoutineHandler,
    CompletedCreateRoutineHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
