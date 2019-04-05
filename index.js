const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');
const argv = require('minimist')(process.argv.slice(1));
const youtubedl = require('youtube-dl');

// -c is used to specify which channel the script should listen to ie. -c https://youtube.com/user/ChannelName
const url = argv.c;
// -f is a boolean value. If the app is being run for the first time then it needs to be set to true. ie. -f true
const first = argv.f;
// -i specifies a setTimeout interval
const interval = argv.i;
// -d is a boolean value. If set to true then it will provide logs for debugging
const dev = argv.d;
let fileName = "";

// Variable for keeping track of how many times in a row the script failed.
let tries = 0; 
// Default setTimeout interval (2 hours)
const intervalDefault = 7200000;

function getData(url) {
	request(url, (err, res, html) => {
		if(!err && res.statusCode == 200) {
			const $ = cheerio.load(html);
			
			// gets json data from a script tag. Note: this sometimes causes JSON.parse to crash the app.
			const data = $('script').get()[8].children[0].data;
			
			jsonParse(data, url);
		}
	});

}

function jsonParse(string, url) {
	try {
		const jsonData = JSON.parse(string);
		const latestVideo = jsonData.itemListElement[0].item.itemListElement[0].url;
		downloadVideo(latestVideo, first);
		tries = 0;
	} catch(e) {
		if(dev == "false" || dev == undefined) { // Basic error logging for a user
			tries++;
			if(tries > 9){
				console.log(`Parsing JSON data failed too many times. Error: ${e}`);
			}
			console.log(`There was an error parsing JSON data, this is a common problem. Retrying... (${tries}/10)`);
			getData(url);
		} else if (dev == "true") {
			console.log(`jsonParse catch block: ${e}`);
			getData(url);
		}
	}
}

function downloadVideo(videoUrl, first) {
	let latestVideoDownloaded = JSON.parse(fs.readFileSync('latest_downloaded.json')).latestVideoDownloaded;
	if((first === "true") || (videoUrl != latestVideoDownloaded && (first == "false" || first == undefined))) { // If -f is true then write videoUrl to a json file and download the audio/video
		writeLatestVideoDownloaded(videoUrl);
		getVideoData(videoUrl);
		if(interval != undefined) {
               		setTimeout(getData, interval, url);
            	} else if (interval == undefined) {
                	setTimeout(getData, intervalDefault, url);
                }
	} else if(videoUrl == latestVideoDownloaded && (first === "false" || first == undefined)) { // If videoUrl is the same as latestVideo then don't download
		console.log("No new videos detected.");

		if(dev == "true") console.log(`latestVideoDownloaded: ${latestVideoDownloaded}`);
		if(interval != undefined) {
			setTimeout(getData, interval, url);
		} else if (interval == undefined) {
			setTimeout(getData, intervalDefault, url);
		}
	}
}

async function getVideoData(videoUrl) { // TODO: Could maybe be done in a different way.
	let video = await youtubedl(videoUrl);
  
        video.on('info', info => {
        	console.log(`Download started for ${info._filename} \n File size: ${(info.size/1048626.62057).toFixed(2)}MB`);
		fileName = info._filename;
		try {
			video.pipe(fs.createWriteStream(fileName));
			console.log("Finished downlading.");
		} catch(e) {
			if(dev == "false" || dev == undefined) {
				console.log("There was an error downloading the video");
			} else if (dev == "true") {
				console.log(`getVideoData catch block: ${e}`);
			}		
		}
        });
}

function writeLatestVideoDownloaded(videoUrl) {
	fs.writeFile("./latest_downloaded.json", JSON.stringify({latestVideoDownloaded: videoUrl}), (err) => {
		if (err && (dev == "false" || dev == undefined)) {
			console.log("There was an error writing the file");
		} else if(err && dev == "true") {
			console.log(`writeLatestVideoDownloaded error: ${err}`);
		} else if (dev == "true") {
			console.log(`${videoUrl} has been written to latest_downloaded.json`);
		}
	});
}

console.log("The script will start listening for new videos in a few seconds.");
getData(url);
