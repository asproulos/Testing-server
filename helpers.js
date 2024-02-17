const fs = require("fs")
function base64ToImg(b64String, outputFileName) {

    var base64Data = b64String.replace(/^data:image\/png;base64,/, "");


    // Store Image into Server

    fs.writeFileSync(outputFileName, base64Data, 'base64', function (err) {
        if (err) console.error(err);
    });
}


/**
 * @returns {string}
 */
function randomID() {
    let rand = Math.random();
    let randStr = rand.toString().substring(2, 4);

    let date = new Date();
    let id = date.getFullYear().toString().padStart(4, "0") +
        (date.getMonth() + 1).toString().padStart(2, "0") +
        date.getDate().toString().padStart(2, "0") +
        date.getHours().toString().padStart(2, "0") +
        date.getMinutes().toString().padStart(2, "0") +
        date.getSeconds().toString().padStart(2, "0") +
        date.getMilliseconds().toString().padStart(4, "0") +
        randStr;
    return id;
}




module.exports = {
    base64ToImg: base64ToImg,
    randomID: randomID,
}