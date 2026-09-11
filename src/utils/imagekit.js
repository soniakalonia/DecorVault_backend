const { ImageKit } = require("@imagekit/nodejs");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const uploadImage = async (file, folder = "") => {
  try {
    const result = await imagekit.files.upload({
      file: file.buffer.toString("base64"),
      fileName: `${Date.now()}-${file.originalname}`,
      folder: folder,
    });
    return result.url;
  } catch (error) {
    throw new Error(`ImageKit upload failed: ${error.message}`);
  }
};

module.exports = { imagekit, uploadImage };
