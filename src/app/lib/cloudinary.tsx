import {v2 as cloudinary} from 'cloudinary';

// Configure Cloudinary using either CLOUDINARY_URL or individual environment variables
if (process.env.CLOUDINARY_URL) {
    // Parse CLOUDINARY_URL format: cloudinary://api_key:api_secret@cloud_name
    const url = new URL(process.env.CLOUDINARY_URL);
    cloudinary.config({
        cloud_name: url.hostname,
        api_key: url.username,
        api_secret: url.password,
    });
    
    console.log('Cloudinary configured with URL:', {
        cloud_name: url.hostname,
        api_key: url.username ? '***' + url.username.slice(-4) : 'missing',
        api_secret: url.password ? '***' + url.password.slice(-4) : 'missing',
    });
} else {
    // Fallback to individual environment variables
    cloudinary.config({
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.API_KEY,
        api_secret: process.env.API_SECRET,
    });
    
    console.log('Cloudinary configured with individual vars:', {
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.API_KEY ? '***' + process.env.API_KEY.slice(-4) : 'missing',
        api_secret: process.env.API_SECRET ? '***' + process.env.API_SECRET.slice(-4) : 'missing',
    });
}

export default cloudinary;