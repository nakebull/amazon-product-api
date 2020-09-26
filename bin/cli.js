#!/usr/bin/env node
const fs = require('fs');
const request = require('request');
const {fromCallback} = require('bluebird');
const AmazonScraper = require('../lib');
const {Parser} = require('json2csv');
const getDirName = require('path').dirname;
const jimp = require('jimp');
const path = require('path');
const download = require('image-downloader')

const readInCsv = (csvFile) => {
    // const regex = RegExp("https://www.amazon.com/([\\w-]+/)?(dp|gp/product)/(\\w+/)?(\\w{10})");
    const regex = /(?:[/dp/]|$)([A-Z0-9]{10})/g;
    return fs.readFileSync(csvFile).toString().split("\n").map(line => {
        const sku = line.substr(0, line.indexOf(',')).trim();
        const amazonUrl = line.substr(line.indexOf(' ') + 1).trim();

        const m = amazonUrl.match(regex);
        if (m === null) {
            console.error("Wrong Url: " + amazonUrl)
        } else {
            return [sku, m[0].replace("/", "")]
        }
    }).filter(x => {
        return x != null
    });
}

const composeImage = async (faceImg) => {

    const getImageDim = (img) => {
        return [img.bitmap.width, img.bitmap.height]
    }
    const isSquare = (img) => {
        return img.bitmap.width === img.bitmap.height
    }
    const getMaxDImage = (img) => {
        return Math.max(img.bitmap.width, img.bitmap.height)
    }

    const getXY = (baseImg, overlayImg) => {
        const dimA = getImageDim(baseImg)
        const dimB = getImageDim(overlayImg)
        const x = Math.max(Math.floor((dimA[0] - dimB[0]) / 2), 0)
        const y = Math.max(Math.floor((dimA[1] - dimB[1]) / 2), 0)
        return [x, y]
    }
    const baseImage = await jimp.read(path.resolve(__dirname, "./base.jpg"));
    const faceImage = await jimp.read(faceImg);

    if (isSquare(faceImage)) {
        return
    }

    const rsz = getMaxDImage(faceImage) + 10;
    baseImage.resize(rsz, rsz);

    const pos = getXY(baseImage, faceImage);
    baseImage.composite(faceImage, pos[0], pos[1]);
    await baseImage.writeAsync(faceImg);
};

const aznClean = (line) => {
    return line.trim()
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/amazon/ig, '')
        .replace(/fba/ig, '')
        .replace(/alexa/ig, '')
        .replace(/assault/ig, '');
};

const calculateWPrice = (aPrice) => {
    return Math.max(((aPrice + 5.5) / 0.6), 9.99).toFixed(2)
};

const wmtFormat = async (sku, data) => {
    const wmt = {
        sku: sku,
        category: "",
        product_name: aznClean(data['title']),
        description: "",
        feature1: "",
        feature2: "",
        feature3: "",
        feature4: "",
        feature5: "",
        feature6: "",
        feature7: "",
        feature8: "",
        feature9: "",
        feature10: "",
        image1: "",
        image2: "",
        image3: "",
        image4: "",
        image5: "",
        image6: "",
        image7: "",
        image8: "",
        image9: "",
        image10: "",
        MSRP: (calculateWPrice(data['price']['current_price']) / 0.6).toFixed(2),
        price: calculateWPrice(data['price']['current_price'])
    }
    try {
        wmt['category'] = data['bestsellers_rank'] ? data['bestsellers_rank'][0]['category'].trim() : ""
    } catch (error) {
        console.log(error);
    }
    data['feature_bullets'].forEach(function (val, idx) {
        if (idx === 9) return
        wmt['feature' + (idx + 1)] = aznClean(val)
    })
    wmt["description"] = data["description"] ? aznClean(data["description"]) : wmt['feature1']
    data['images'].forEach(function (val, idx) {
        if (idx === 9) return
        const imageFile = "390233/" + sku.trim().replace("_", "/") + "/" + (idx + 1) + ".jpg"
        fs.mkdir(getDirName(imageFile), {recursive: true}, (err) => {
            if (err) throw err;
        });

        try {
            downloadImage(val, imageFile, function () {
                if (imageFile.includes("/1.jpg")) {
                    composeImage(imageFile)
                }
            })
            wmt['image' + (idx + 1)] = "http://imgtong.s3.amazonaws.com/" + imageFile
        } catch (e) {
            console.error(e)
        }

    })
    return wmt
}

const downloadImage = function (uri, filename, callback) {
    try {
        download.image({url: uri, dest: filename})
            .then(callback)
            .catch((err) => console.error(err))
    } catch (e) {

    }
};

const startScraper = async (argv) => {

    try {
        if (argv['_'][0] === 'asinfile') {
            console.log(argv.file)
            const tasks = readInCsv(argv.file)
            const jsonToCsv = new Parser({flatten: true});
            const res = []
            const failed = []
            for (let t of tasks) {
                argv.asin = t[1];

                try {
                    const data = await AmazonScraper['asin']({
                        ...argv,
                        cli: true,
                        rating: [argv['min-rating'], argv['max-rating']]
                    });
                    const wmt = await wmtFormat(t[0], data.result[0])
                    res.push(wmt);

                    await setTimeout(function () {
                        console.log("Executing:" + t[1])
                        console.log("Sleeping for 5s")
                    }, 5000);

                } catch (e) {
                    console.log(e);
                    console.error(t[0] + ": Failed");
                    failed.push(t);
                }
            }
            await fromCallback((cb) => fs.appendFile(argv.file + `_processed.csv`, jsonToCsv.parse(res), 'utf8', (cb) => {
                console.error("Failed tasks :" + JSON.stringify(failed))
            }));


        } else {
            argv.scrapeType = argv._[0];
            const data = await AmazonScraper[argv.scrapeType]({
                ...argv,
                cli: true,
                rating: [argv['min-rating'], argv['max-rating']]
            });
            switch (argv.scrapeType) {
                case 'countries':
                    console.table(data);
                    break;
                case 'categories':
                    console.table(data);
                    break;
                case 'products':
                case 'reviews':
                    if (!argv.filetype) {
                        console.log(JSON.stringify(data));
                    }
                    break;
                case 'asin':
                    if (!argv.filetype) {
                        console.log(data.result[0]);
                    }
                    break;
                default:
                    break;
            }
        }
    } catch (error) {
        console.log(error);
    }
};

require('yargs')
    .usage('Usage: $0 <command> [options]')
    .example(`$0 products -k 'Xbox one'`)
    .example(`$0 products -k 'Xbox one' --country 'GB'`)
    .example(`$0 reviews B01GW3H3U8`)
    .example(`$0 asin B01GW3H3U8`)
    .example(`$0 categories`)
    .example(`$0 countries`)
    .command('products', 'collect products by using keyword', {}, (argv) => {
        startScraper(argv);
    })
    .command('reviews [id]', 'collect reviews from product by using ASIN id', {}, (argv) => {
        startScraper(argv);
    })
    .command('asin [id]', 'single product details', {}, (argv) => {
        startScraper(argv);
    })
    .command('asinfile [file]', 'product details from file with urls', {}, (argv) => {
        startScraper(argv);
    })
    .command('categories', 'get list of categories', {}, (argv) => {
        startScraper(argv);
    })
    .command('countries', 'get list of countries', {}, (argv) => {
        startScraper(argv);
    })
    .options({
        help: {
            alias: 'h',
            describe: 'help',
        },
        async: {
            alias: 'a',
            default: '5',
            type: 'string',
            describe: 'Number of async tasks',
        },
        keyword: {
            alias: 'k',
            default: '',
            type: 'string',
            describe: "Amazon search keyword ex. 'Xbox one'",
        },
        number: {
            alias: 'n',
            default: 20,
            type: 'number',
            describe: 'Number of products to scrape. Maximum 100 products or 300 reviews',
        },
        filetype: {
            default: '',
            choices: ['csv', 'json', 'all', ''],
            describe: "Type of the output file where the data will be saved. 'all' - save data to the 'json' and 'csv' files",
        },
        sort: {
            default: false,
            type: 'boolean',
            describe:
                'If searching for the products then the list will be sorted by the higher score(number of reviews*rating). If searching for the reviews then they will be sorted by the rating.',
        },
        discount: {
            alias: 'd',
            default: false,
            type: 'boolean',
            describe: 'Scrape only products with the discount',
        },
        sponsored: {
            default: false,
            type: 'boolean',
            describe: 'Scrape only sponsored products',
        },
        'min-rating': {
            default: 1,
            type: 'number',
            describe: 'Minimum allowed rating',
        },
        'max-rating': {
            default: 5,
            type: 'number',
            describe: 'Maximum allowed rating',
        },
        country: {
            default: 'US',
            type: 'string',
            describe:
                'In ISO 3166 (Alpha-2 code) format. To get available list of countries enter and use country_code value from the displayed table: amazon-buddy countries',
        },
        category: {
            default: 'aps',
            type: 'string',
            describe: 'To get available list of categories type and use {category} value from the displayed table: amazon-buddy categories',
        },
        'random-ua': {
            default: false,
            type: 'boolean',
            describe: 'Randomize user agent version. This helps to prevent request blocking from the amazon side',
        },
        'user-agent': {
            default: '',
            type: 'string',
            describe: 'Set custom user-agent',
        },
        timeout: {
            alias: 't',
            default: 0,
            type: 'number',
            describe: 'Timeout between requests. Timeout is set in mls: 1000 mls = 1 second',
        },
    })
    .check((argv) => {
        if (['products', 'reviews', 'asinfile', 'asin', 'categories', 'countries'].indexOf(argv['_'][0]) === -1) {
            throw 'Wrong command';
        }
        if (argv['_'][0] === 'products') {
            if (!argv.keyword || !argv.k) {
                throw 'Keyword is missing';
            }
        }
        if (argv['_'][0] === 'reviews') {
            if (!argv.id) {
                throw 'ASIN is missing';
            } else {
                argv.asin = argv.id;
            }
        }

        if (argv['_'][0] === 'asin') {
            if (!argv.id) {
                throw 'ASIN is missing';
            } else {
                argv.asin = argv.id;
            }
        }
        if (argv['_'][0] === 'asinfile') {
            if (!argv.file) {
                throw 'product file is missing';
            }
        }

        // Minimum allowed rating is 1
        if (!argv['min-rating']) {
            argv['min-rating'] = 1;
        }
        // Maximum allowed rating is 5
        if (!argv['max-rating']) {
            argv['max-rating'] = 5;
        }

        // If custom 'user-agent' was set then we need to make sure that 'random-ua' is disabled
        if (argv['random-ua'] && argv['user-agent']) {
            argv['random-ua'] = false;
        }
        if (argv['user-agent']) {
            argv.ua = argv['user-agent'];
        }
        if (argv['random-ua']) {
            argv.randomUa = true;
        }
        return true;
    })
    .demandCommand().argv;
