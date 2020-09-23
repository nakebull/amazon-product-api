const jimp = require('jimp');

// const composeImage = async (faceImg) => {
//
//     const getImageDim = (img) => {
//         return [img.bitmap.width, img.bitmap.height]
//     }
//     const isSquare = (img) => {
//         return img.bitmap.width === img.bitmap.height
//     }
//
//     const getMaxDImage = (img) => {
//         return Math.max(img.bitmap.width, img.bitmap.height)
//     }
//
//     const getXY = (baseImg, overlayImg) => {
//         const dimA = getImageDim(baseImg)
//         const dimB = getImageDim(overlayImg)
//         const x = Math.max(Math.floor((dimA[0] - dimB[0]) / 2), 0)
//         const y = Math.max(Math.floor((dimA[1] - dimB[1]) / 2), 0)
//         return [x, y]
//     }
//
//     const baseImage = await jimp.read('0.jpg');
//     const faceImage = await jimp.read(faceImg);
//
//     if (isSquare(faceImage)) {
//         return
//     }
//
//     const rsz = getMaxDImage(faceImage)
//     baseImage.resize(rsz, rsz)
//
//     const pos = getXY(baseImage, faceImage)
//     baseImage.composite(faceImage, pos[0], pos[1])
//     await baseImage.writeAsync(faceImg);
// }


(async () => {

    const image = await jimp.read('0.jpg');
    await image.resize(3000, 300);

    // await composeImage('2.jpg')

})();




