import { NextRequest, NextResponse } from 'next/server';
import { UploadImage } from '@/app/lib/upload';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { connectToDatabase } from '@/lib/mongoose';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    // Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image size must be less than 5MB' }, { status: 400 });
    }

    console.log('Uploading profile image:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      type: file.type,
      userId: user._id
    });

    // Upload to Cloudinary using the existing UploadImage function
    const uploadResult = await UploadImage(file, 'profile-pictures') as any;
    console.log("Profile image uploaded:", uploadResult);

    if (uploadResult && uploadResult.secure_url) {
      return NextResponse.json({
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id
      });
    } else {
      throw new Error('Upload failed - no secure URL returned');
    }

  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
