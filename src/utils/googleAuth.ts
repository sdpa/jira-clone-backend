import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'your-google-client-id-here.apps.googleusercontent.com') {
  console.warn('⚠️  WARNING: GOOGLE_CLIENT_ID is not properly configured in .env file!');
  console.warn('   Please set GOOGLE_CLIENT_ID in your .env file');
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface GoogleUserInfo {
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  sub: string; // Google user ID
}

/**
 * Verify Google ID token and extract user information
 * @param idToken - The ID token from Google OAuth
 * @returns User information from the verified token
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
  try {
    console.log('🔍 Verifying Google token...');
    console.log('📋 Expected Client ID (backend):', GOOGLE_CLIENT_ID);
    
    // Decode token to see audience before verification
    try {
      const base64Payload = idToken.split('.')[1];
      const decodedPayload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
      console.log('📋 Token Audience (from frontend):', decodedPayload.aud);
      console.log('🔍 Match:', decodedPayload.aud === GOOGLE_CLIENT_ID ? '✅ YES' : '❌ NO - THIS WILL FAIL!');
    } catch (e) {
      console.log('⚠️  Could not decode token to preview audience');
    }
    
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    
    if (!payload) {
      throw new Error('Invalid token payload');
    }

    console.log('✅ Token verified successfully for:', payload.email);

    if (!payload.email || !payload.email_verified) {
      throw new Error('Email not verified');
    }

    return {
      email: payload.email,
      email_verified: payload.email_verified,
      name: payload.name || '',
      given_name: payload.given_name,
      family_name: payload.family_name,
      picture: payload.picture,
      sub: payload.sub,
    };
  } catch (error: any) {
    console.error('❌ Error verifying Google token:', error.message);
    console.error('🔍 Backend expects Client ID:', GOOGLE_CLIENT_ID);
    
    // Try to decode the token without verification to see what client ID it was issued for
    try {
      const base64Payload = idToken.split('.')[1];
      const decodedPayload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
      console.error('📋 Token was issued for Client ID:', decodedPayload.aud);
      console.error('⚠️  MISMATCH: Frontend and Backend are using different Google Client IDs!');
      console.error('💡 Solution: Update your backend .env GOOGLE_CLIENT_ID to match:', decodedPayload.aud);
    } catch (decodeError) {
      console.error('Could not decode token to show audience');
    }
    
    throw new Error('Invalid Google token');
  }
}

