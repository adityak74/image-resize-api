// server.js
// where your node app starts

// init project
require('dotenv').config();
var express = require('express');
var request = require('superagent');
var { createCanvas, loadImage } = require('canvas');
var fs = require('fs');
var path = require('path');
var app = express();

// enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
// so that your API is remotely testable by FCC 
var cors = require('cors');
app.use(cors({optionsSuccessStatus: 200}));  // some legacy browsers choke on 204

const imageBaseUrl = 'https://s3-us-west-2.amazonaws.com/makersdistillery/1000x/';

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

const resizeImage = (imagePath, paramWidth, paramHeight, paramFormat, paramRotate) => {
  console.log('resizeImage', imagePath, paramWidth, paramHeight);
  return new Promise((resolve, reject) => {
    loadImage(imagePath).then(image => {
      const imageWidth = image.width;
      const imageHeight = image.height;
      const aspectRatio = imageHeight > imageWidth ? imageHeight / imageWidth : imageWidth / imageHeight;
      const adjustedHeight = parseInt(paramHeight || paramWidth * aspectRatio);
      let adjustedWidth;
      if (!paramWidth) {
        adjustedWidth = Math.round((imageWidth / imageHeight) * adjustedHeight);
      } else {
        adjustedWidth = parseInt(paramWidth);
      }
      const canvas = createCanvas(imageWidth, imageHeight);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
      const copyCanvas = createCanvas(adjustedWidth, adjustedHeight);
      const copyCtx = copyCanvas.getContext('2d');
      copyCtx.drawImage(canvas, 0, 0, imageWidth, imageHeight, 0, 0, adjustedWidth, adjustedHeight);
      // apply rotation if needed
      if (parseInt(paramRotate)) {
        const toRotate = parseInt(paramRotate) * Math.PI / 180;
        const rotateCanvas = createCanvas(adjustedWidth, adjustedHeight);
        const rotateCtx = rotateCanvas.getContext('2d');
        rotateCtx.translate(adjustedWidth / 2, adjustedHeight / 2);
        rotateCtx.rotate(toRotate);
        rotateCtx.drawImage(copyCanvas, -adjustedWidth / 2, -adjustedHeight / 2);
        return resolve(rotateCanvas.toDataURL('image/jpeg'));
      }
      // save the image
      const data = copyCanvas.toDataURL('image/jpeg');
      resolve(data);
    }).catch(err => {
      console.log('resizeImage error', err);
      reject(err);
    });
  });
};

// image service endoint
app.get("/images/:imageUIDPath", function (req, res) {
  const { imageUIDPath } = req.params;
  if (!imageUIDPath || imageUIDPath.length === 0) {
    return res.status(400).send('imageUIDPath is required');
  }
  request
    .get(`${imageBaseUrl}${imageUIDPath}`)
    .end(async function (error, response) {
      if (error) {
        console.log(error);
        res.status(500).send(error);
      } else {
        const { h, w, format, rotate } = req.query;
        if ((h && isNaN(h)) || (w && isNaN(w))) {
          return res.status(400).send({
            error: 'h/w must be a number'
          });
        }
        if (!h && !w) {
          res.set("Content-Type", "image/jpeg");
          return res.status(200).send(response.body);
        }
        const imageTempPath = path.join(__dirname, imageUIDPath);
        const imageFile = fs.createWriteStream(imageTempPath);
        imageFile.write(response.body);
        imageFile.end();
        imageFile.on('finish', async () => {
          console.log('imageFile.on finish');
          const imageData = await resizeImage(imageTempPath, w, h, format, rotate);
          fs.unlink(imageTempPath, () => {});
          res.set("Content-Type", "text/html");
          return res.status(200).send(`<html><body><img src="${imageData}" /></body></html>`);
        });
      }
    });
});


// listen for requests :)
var listener = app.listen(9001 || process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
