const crypto = require("crypto");

const MAX_NUMBER_OF_ROLL_ORDER_ELEMENTS = 40;
const MAX_LENGTH_OF_ROLL_ORDER = 150;
const MAX_NUMBER_OF_DICES = 40;

exports.handleRoll = function (payload, sender){
    if (payload.length > MAX_LENGTH_OF_ROLL_ORDER) {
        console.log('too long order');
        return;
    }

    const [rollCommand, metaCommand] = splitRollPayload(payload, '%');
    if (!rollCommand) return;
    const [rawOrder, comment] = splitRollPayload(rollCommand, '#');
    if (!rawOrder) return;
    if (rawOrder.split('+').length > MAX_NUMBER_OF_ROLL_ORDER_ELEMENTS || rawOrder.split('-').length > MAX_NUMBER_OF_ROLL_ORDER_ELEMENTS){
        console.log('too big order');
        return;
    }

    const [result, text] = processRollOrder(rawOrder);
    if (!result){
        console.log('too many dices');
        return;
    }
    const rollResult = {
        id: crypto.randomBytes(8).toString("hex"),
        messageTypeName: 'roll',
        text: text,
        result: result,
        rawOrder: rawOrder.trim(),
        sender: sender || 'Spy'
    };
    if (comment) rollResult.comment = comment;
    return rollResult;
}


function splitRollPayload(payload, divider) {
    const base = payload.charAt(0) === divider ? payload.substr(1) : payload;
    const splited = base.split(divider);
    if (splited.length > 2) return;
    if (splited.length > 1) return [...splited];
    return [...splited, null]; 
}

function processRollOrder(order){
    const raw = order.replaceAll(' ', '');
    let misspeled = false;
    let resultValue = 0;
    let resultString = '';
    let currentString = '';
    let isCurrentRoll = false;
    let rollsCount = 1;
    let operation = 'add';
    let diceCounter = 0;

    for (let char of raw){
        if (!isNaN(char)){
            currentString += char;
            continue;
        }
        if (char === 'd'){
            isCurrentRoll = true;
            rollsCount = Number(currentString) || 1;
            currentString = '';
            continue;
        }
        if (['+', '-'].includes(char)){
            if (!isCurrentRoll) rollsCount = Number(currentString);
            diceCounter += rollsCount;
            if (diceCounter > MAX_NUMBER_OF_DICES) return [null, 'too many dices'];
            appendRollValue(misspeled, isCurrentRoll, rollsCount, currentString);

            char === '+'? operation = 'add': operation = 'sub';
            isCurrentRoll = false;
            currentString = '';
            misspeled = false;
            rollsCount = 1;
            continue;
        }

        misspeled = true;

    }
    if (!isCurrentRoll) rollsCount = Number(currentString);
    appendRollValue(misspeled, isCurrentRoll, rollsCount, currentString);

    diceCounter += rollsCount;
    if (diceCounter > MAX_NUMBER_OF_DICES) return [null, 'too many dices'];

    return [resultValue, resultString];



    function appendRollValue(error, isRoll, count, currentDiceString = ''){
        if (error) return;

        if (!isRoll && operation === 'add') addValue(Number(count), String(count));
        if (!isRoll && operation === 'sub') subtractValue(Number(count), String(count));
        if (!isRoll) return;

        const [currentValue, currentText] = rollDices(count, Number(currentDiceString));
        if (operation === 'add') addValue(currentValue, currentText);
        if (operation === 'sub') subtractValue(currentValue, currentText);
    }

    function addValue(numericValue, stringValue) {
        resultString === ''? resultString = `${stringValue}`: resultString += ` + ${stringValue}`;
        resultValue += numericValue;
    }

    function subtractValue(numericValue, stringValue){
        resultString += ` - ${stringValue}`;
        resultValue -= numericValue;
    }
}

function rollDices(count, dice){
    let resultValue = 0;
    let stringValue = '';
    let currentValue = 0;
    for (let i = 0; i < count; i++) {
        currentValue = randomNumber(1, dice);
        resultValue += currentValue;
        stringValue === ''? stringValue = String(currentValue): stringValue += ` + ${currentValue}`;
    }
    return [resultValue, stringValue];

}

function randomNumber(min, max) {
    min = Number(min);
    max = Number(max);
    result = Math.floor(Math.random() * max) + min;
	return result; 
}
