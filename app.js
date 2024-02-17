const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const multer = require('multer');
const ws = require('ws');
let cors = require('cors');
let upload = multer({ dest: './upload/' });
let type = upload.single('myFile');

let { base64ToImg, randomID } = require("./helpers");

let privateKey = fs.readFileSync('sslcert/server.key', 'utf8');
let certificate = fs.readFileSync('sslcert/server.crt', 'utf8');
let credentials = { key: privateKey, cert: certificate };

const express = require('express');
const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.use('/public', express.static('public'));

const httpPort = 6969;
const httpsPort = 4242;
const hostname = '0.0.0.0';

app.get('/fietser', function (req, res) {
    res.sendFile(path.join(__dirname, '/Fietsersbond.apk'));
});

app.get('/pdf', function (req, res) {
    res.sendFile(path.join(__dirname, './pages/pdf.html'));
});

app.get('/page1', function (req, res) {
    res.sendFile(path.join(__dirname, './pages/test1.html'));
});

app.get('/page2', function (req, res) {
    res.sendFile(path.join(__dirname, './pages/test2.html'));
});

app.get('/appVersion', function (req, res) {
    let directory = fs.readdirSync(path.join(__dirname, './cordova/'));
    let version = 0;
    if (directory[0]) {
        version = directory[0].replace('elstat-', '').replace('.apk', '');
    }
    res.send(version);
});

app.get('/app', function (req, res) {
    let directory = fs.readdirSync(path.join(__dirname, './cordova/'));
    res.send(fs.readFileSync(path.join(__dirname, './cordova/', directory[0])));
});

app.post('/upload', type, function (req, res) {
    let fileData = req.file;
    if (!fileData) {
        res.send('no file');
        return;
    }
    try {
        fs.renameSync(path.join(fileData.destination, fileData.filename), path.join(fileData.destination, fileData.originalname));
        console.log('Upload complete for file "' + fileData.originalname + '"');
    } catch (error) {
        console.error('failed to rename file "' + fileData.originalname + '"');
        console.error(error);
    }
    res.send('ok');
});

app.get("/pdfimage", function (req, res) {
    res.sendFile(path.join(__dirname, './pages/pdf-signer.html'));
});

app.post('/pdfimage', type, function (req, res) {
    let fileData = req.file;
    if (!fileData) {
        res.status(300).send('no file');
        return;
    }
    let filename = fileData.originalname;
    if (req.query.fileName) filename = req.query.fileName;
    try {
        fs.renameSync(path.join(fileData.destination, fileData.filename), path.join(fileData.destination, filename));
        let b64Data = fs.readFileSync(path.join(fileData.destination, filename));
        let finalPath = path.join(fileData.destination, "./pdf-signatures", filename.replace(/\..*/g, "") + '.png');
        if (!fs.existsSync(path.join(fileData.destination, "./pdf-signatures"))) fs.mkdirSync(path.join(fileData.destination, "./pdf-signatures"));
        base64ToImg(b64Data.toString(), finalPath);
        fs.unlinkSync(path.join(fileData.destination, filename));
        console.log('Upload and conversion complete for file "' + filename + '".');
    } catch (error) {
        res.status(500).send();
        console.error('failed to rename file "' + filename + '"');
        console.error(error);
    }

    res.send('ok');
});

app.get('*', function (req, res) {
    res.sendFile(path.join(__dirname, './pages/index.html'));
});


// HTTP
var httpServer = http.createServer(app);
httpServer.listen(httpPort, hostname, function () {
    console.log('Http server listening on port ' + httpPort);
});

// HTTPS
var httpsServer = https.createServer(credentials, app);
httpsServer.listen(httpsPort, hostname, function () {
    console.log('Https server listening on port ' + httpsPort);
});



/** @type {Array<ws>} */
let clients = [];

let wss = new ws.WebSocketServer({ server: httpsServer });
wss.on('connection', function (ws, request, client) {
    const mySecretID = randomID();
    ws.mySecretID = mySecretID;

    ws.on('error', console.error);
    ws.on('message', function (data, a) {
        if (clients.length > 2) return;
        if (data.length > 1000) {
            clients.forEach(function (socket) {
                if (socket.mySecretID === mySecretID) return;
                socket.send(data);
            });
        } else {
            let str = data.toString();
            let json = JSON.parse(str);
            if (json.action === "connect") {
                clients.push(ws);
                console.log("User joined", clients.length);
                ws.send(JSON.stringify({ user: mySecretID, action: "connect" }));
            }
        }
    });

    ws.on("close", function (origin, targets) {
        clients.forEach(function (socket) {
            if (socket.mySecretID === mySecretID) return;
            socket.send(JSON.stringify({ user: mySecretID, action: "close" }));
        });

        let index = clients.findIndex((socket) => socket === ws);
        console.log("User " + (index + 1) + " disconnected.")
        clients.splice(index, 1);
    });

});