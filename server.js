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

const resizeImage = (imageUIDPath, imagePath, paramWidth, paramHeight) => {
  console.log('resizeImage', imagePath, paramWidth, paramHeight);
  return new Promise((resolve, reject) => {
    loadImage(imagePath).then(image => {
      const imageWidth = image.width;
      const imageHeight = image.height;
      const aspectRatio = imageHeight / imageWidth;
      const adjustedHeight = paramHeight || paramWidth * aspectRatio;
      let adjustedWidth;
      if (!paramWidth) {
        adjustedWidth = (imageWidth / imageHeight) * adjustedHeight;
      } else {
        adjustedWidth = paramWidth;
      }
      const canvas = createCanvas(imageWidth, imageHeight);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, imageWidth, imageHeight, 0, 0, adjustedWidth, adjustedHeight);
      const data = canvas.toDataURL('image/jpeg');
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
        const { h, w, format } = req.query;
        if ((h && isNaN(h)) || (w && isNaN(w))) {
          return res.status(400).send({
            error: 'h/w must be a number'
          });
        }
        if (!h && !w) {
          res.set("Content-Type", "image/jpeg");
          return res.status(200).send(response.body);
        }
        const imageTempPath = path.join(__dirname, 'temp', imageUIDPath);
        fs.createWriteStream(imageTempPath).write(response.body);
        const base64ImageString = await resizeImage(imageUIDPath, imageTempPath, w, h);
        console.log('base64ImageString', base64ImageString);
        res.set("Content-Type", "image/jpeg");
        return res.status(200).send(base64ImageString);
        // fs.unlink(imageTempPath, () => {});
      }
    });
});



// listen for requests :)
var listener = app.listen(9001, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
