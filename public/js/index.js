document.addEventListener("DOMContentLoaded", function (event) {
    indexIIFE();
    cameraIIFE();
});

const frameRate = 60;
const milliSecond = 1;
const second = 1000 * milliSecond;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;
const delayPerFrame = second / frameRate;

function indexIIFE() {
    let form = document.querySelector("form");
    form.addEventListener("submit", submitForm);

    function submitForm(e) {
        e.preventDefault();
        const files = document.getElementById("my-file");
        if (files.files.length === 0) {
            alert("No file selected.");
            return;
        }


        const formData = new FormData();
        for (let i = 0; i < files.files.length; i++) {
            formData.append("myFile", files.files[i]);
        }
        fetch("/upload", {
            method: 'POST',
            body: formData,
            // headers: {
            //     "Content-Type": "multipart/form-data"
            // }
        })
            .then((res) => {
                console.log(res);

                let clearBtn = document.querySelector("#clear-btn");
                if (clearBtn) clearBtn.dispatchEvent(new Event("click"));
            })
            .catch((err) => {
                console.log(err);
                alert("Something went wrong.");
            });
    }

    const noFileString = "No file selected.";
    /** @type {HTMLInputElement} */
    let myFileInput = document.querySelector("#my-file");
    let display = document.querySelector("#file-input-display");
    if (!myFileInput || !display) return;

    display.textContent = noFileString;
    myFileInput.addEventListener("change", function (event) {
        if (myFileInput.files.length > 0) {
            display.textContent = myFileInput.files[0].name;
        } else {
            display.textContent = noFileString;
        }
    });

    let clearBtn = document.querySelector("#clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", function (event) {
        myFileInput.value = "";
        myFileInput.dispatchEvent(new Event("change"));
    });
}


// video is local only, TODO send to server and stream from there
function cameraIIFE() {
    /** @type {HTMLVideoElement} */
    const video = document.querySelector("#camera-feed");

    /** @type {HTMLCanvasElement} */
    let canvas = document.querySelector("#camera-canvas");
    let context = canvas.getContext("2d");
    const constraints = {
        audio: false,
        video: {
            width: { ideal: 800 },
            height: { ideal: 600 },
        },
    };

    navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
            const videoTracks = stream.getVideoTracks();
            console.log("Got stream with constraints:", constraints);
            console.log(`Using video device: ${videoTracks[0].label}`);
            window.test = videoTracks[0];

            stream.onremovetrack = () => {
                console.log("Stream ended");
            };

            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                socketsIIFE(video);
            };
        })
        .catch((error) => {
            if (error.name === "OverconstrainedError") {
                console.error(
                    `The resolution ${constraints.video.width.exact}x${constraints.video.height.exact} px is not supported by your device.`,
                );
            } else if (error.name === "NotAllowedError") {
                console.error(
                    "You need to grant this page permission to access your camera and microphone.",
                );
            } else {
                console.error(`getUserMedia error: ${error.name}`, error);
            }
        });
};


// socket stuff
/**
 * @param {HTMLVideoElement} videoElement 
 */
function socketsIIFE(videoElement) {
    let myID = null;
    // Create WebSocket connection.
    const socket = new WebSocket("wss://" + window.location.host + "/chat");

    // Connection opened
    socket.addEventListener("open", (event) => {
        socket.send(JSON.stringify({ action: "connect" }));
    });



    /** @type {HTMLCanvasElement} */
    let myCanvas = document.querySelector("#camera-canvas");
    let myContext = myCanvas.getContext("2d")
    let otherUser = null;
    // Listen for messages
    let myIntervalID = null;
    socket.addEventListener("message", (event) => {
        if (!(event.data instanceof Blob)) {
            let responseJson = JSON.parse(event.data);
            if (responseJson.action === "connect") {
                myID = responseJson.user;
                myIntervalID = startStreaming();
            } else if (responseJson.action === "close") {
                let user = users.get(responseJson.user)
                if (!user) return;
                user.remove();
                users.delete(responseJson.user);
            }
        } else {
            event.data.arrayBuffer().then(function (arrayBuffer) {
                let pixelArray = new Uint8ClampedArray(arrayBuffer.slice(0, arrayBuffer.byteLength - 12));
                let dimensions = arrayBuffer.slice(arrayBuffer.byteLength - 12); // 001280000800

                let encoder = new TextDecoder("utf-8");
                let width = encoder.decode(dimensions.slice(0, 6));
                let height = encoder.decode(dimensions.slice(6));

                if (otherUser) {
                    let ctx = otherUser.getContext("2d");
                    let imgData = new ImageData(pixelArray, otherUser.width, otherUser.height);

                    ctx.putImageData(imgData, 0, 0);
                } else {
                    let canv = document.createElement("canvas");
                    canv.width = width;
                    canv.height = height;
                    document.body.append(canv);
                    otherUser = canv;

                    let ctx = otherUser.getContext("2d");
                    let imgData = new ImageData(pixelArray, otherUser.width, otherUser.height);

                    ctx.putImageData(imgData, 0, 0);
                }
            });
        }
    });



    window.addEventListener("beforeunload", function () {
        socket.close();
    });


    // let once = false;
    // window.addEventListener("click", function () {
    //     once = false;
    // });

    function startStreaming() {
        return setInterval(function () {
            if (!myID) return;
            createImageBitmap(videoElement).then(function (imageBitmap) {
                // if (once) return;
                // once = true;

                myContext.drawImage(imageBitmap, 0, 0);
                let imageData = myContext.getImageData(0, 0, myCanvas.width, myCanvas.height);
                var blob = new Blob([imageData.data, imageData.width.toString().padStart(6, "0"), imageData.height.toString().padStart(6, "0")], { type: "octet/stream" });

                socket.send(blob);
            });
        }, second/2);
    }
}