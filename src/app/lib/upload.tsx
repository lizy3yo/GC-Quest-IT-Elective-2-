import cloudinary from "./cloudinary";

// Helper function to check Cloudinary configuration
const checkCloudinaryConfig = () => {
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
        console.error('Cloudinary configuration missing:', {
            cloud_name: config.cloud_name ? 'set' : 'missing',
            api_key: config.api_key ? 'set' : 'missing',
            api_secret: config.api_secret ? 'set' : 'missing'
        });
        throw new Error('Cloudinary configuration is incomplete. Please check your environment variables.');
    }
    console.log('Cloudinary configuration verified');
    return true;
};

export const UploadImage = async (file: File, folder: string) => {
    // Check configuration before attempting upload
    checkCloudinaryConfig();
    
    const buffer = await file.arrayBuffer();
    const bytes = Buffer.from(buffer);

    // Sanitize the filename for Cloudinary public_id
    const sanitizedName = sanitizeFilename(file.name);
    
    console.log('Image upload settings:', {
        originalFileName: file.name,
        sanitizedFileName: sanitizedName
    });

    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({
            resource_type: 'auto',
            folder: folder,
            // Use sanitized filename with timestamp to prevent conflicts
            public_id: `${Date.now()}-${sanitizedName}`,
            // Preserve original filename in metadata
            context: `original_name=${file.name}`,
            // Allow raw files (PDFs, docs, etc.)
            flags: "attachment"
        }, async (error, result) => {
            if (error) {
                console.error('Cloudinary Upload Error:', error);
                return reject(error);
            }
            return resolve(result);
        }).end(bytes);
    });
}

// Helper function to sanitize filename for Cloudinary public_id
const sanitizeFilename = (filename: string): string => {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    
    // Replace invalid characters with hyphens or underscores
    // Cloudinary only allows: alphanumeric, hyphens, underscores, and forward slashes
    return nameWithoutExt
        .replace(/[^\w\s-]/g, '-')  // Replace special chars (except word chars, spaces, hyphens) with hyphens
        .replace(/\s+/g, '_')        // Replace spaces with underscores
        .replace(/_{2,}/g, '_')      // Replace multiple underscores with single underscore
        .replace(/-{2,}/g, '-')      // Replace multiple hyphens with single hyphen
        .replace(/^[-_]+|[-_]+$/g, '') // Remove leading/trailing hyphens or underscores
        .substring(0, 100);          // Limit length to 100 characters
};

// Separate function specifically for file uploads to maintain clarity
export const UploadFile = async (file: File, folder: string) => {
    // Check configuration before attempting upload
    checkCloudinaryConfig();
    
    const buffer = await file.arrayBuffer();
    const bytes = Buffer.from(buffer);

    // Determine the correct resource type based on file type
    const fileType = file.type || '';
    const fileName = file.name.toLowerCase();
    
    // Force non-image files to use 'raw' resource type
    let resourceType: 'auto' | 'raw' | 'image' | 'video' = 'auto';
    if (!fileType.startsWith('image/') || 
        fileName.endsWith('.pdf') || 
        fileName.endsWith('.doc') || 
        fileName.endsWith('.docx') || 
        fileName.endsWith('.xls') || 
        fileName.endsWith('.xlsx') || 
        fileName.endsWith('.ppt') || 
        fileName.endsWith('.pptx') || 
        fileName.endsWith('.txt') || 
        fileName.endsWith('.zip') || 
        fileName.endsWith('.rar')) {
        resourceType = 'raw';
    }
    
    // Sanitize the filename for Cloudinary public_id
    const sanitizedName = sanitizeFilename(file.name);
    
    console.log('Upload settings:', {
        originalFileName: file.name,
        sanitizedFileName: sanitizedName,
        fileType: fileType,
        detectedResourceType: resourceType
    });

    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({
            resource_type: resourceType, // Use determined resource type instead of 'auto'
            folder: folder,
            // Use sanitized filename with timestamp to prevent conflicts
            public_id: `${Date.now()}-${sanitizedName}`,
            // Preserve original filename in metadata
            context: `original_name=${file.name}`,
            // Allow access to raw file URL for downloads
            flags: "attachment",
            // Set appropriate access mode
            access_mode: "public"
        }, async (error, result) => {
            if (error) {
                console.error('Cloudinary File Upload Error:', error);
                
                // Provide more specific error messages
                if (error.message && error.message.includes('file size')) {
                    const enhancedError = new Error('File size exceeds Cloudinary limits. Please use a file smaller than 10MB.');
                    enhancedError.name = 'FileSizeError';
                    return reject(enhancedError);
                } else if (error.message && error.message.includes('Invalid file type')) {
                    const enhancedError = new Error('File type not supported. Please use PDF, Word, Excel, PowerPoint, or image files.');
                    enhancedError.name = 'FileTypeError';
                    return reject(enhancedError);
                } else if (error.message && error.message.includes('api_key')) {
                    const enhancedError = new Error('Cloudinary configuration error. Please contact support.');
                    enhancedError.name = 'ConfigurationError';
                    return reject(enhancedError);
                }
                
                return reject(error);
            }
            console.log('Cloudinary Upload Success:', {
                public_id: result?.public_id,
                resource_type: result?.resource_type,
                format: result?.format,
                bytes: result?.bytes
            });
            return resolve(result);
        }).end(bytes);
    });
}