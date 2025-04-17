import Mailjet from 'node-mailjet';

// Environment variables are already loaded by the server

async function testMailjet() {
  try {
    const apiKey = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    
    if (!apiKey || !secretKey) {
      console.error('Missing Mailjet API keys');
      return;
    }
    
    console.log(`Using Mailjet API key: ${apiKey.substring(0, 4)}...`);
    console.log(`Using Mailjet Secret key: ${secretKey.substring(0, 4)}...`);
    
    const mailjet = Mailjet.apiConnect(apiKey, secretKey);
    
    // First, try to get information about our API keys
    try {
      const apiKeyInfo = await mailjet
        .get('apikey')
        .request();
      
      console.log('API Key information:');
      console.log(JSON.stringify(apiKeyInfo.body, null, 2));
    } catch (keyError) {
      console.error('Error getting API key info:', keyError);
    }
    
    // Try sending a test email
    const emailData = {
      Messages: [
        {
          From: {
            Email: 'api@acrdsc.org',
            Name: 'ACRDSC Reservas Test'
          },
          To: [
            {
              Email: 'dr.pjlemos@gmail.com',
              Name: 'Pedro Lemos'
            }
          ],
          Subject: 'Test Email from Mailjet API Direct',
          TextPart: 'This is a test email sent directly from the Mailjet API to verify functionality.',
          HTMLPart: '<h3>This is a test email sent directly from the Mailjet API to verify functionality.</h3>',
          TrackOpens: 'enabled',
          TrackClicks: 'enabled',
          CustomID: 'TestEmail-' + Date.now() 
        }
      ]
    };
    
    console.log('Sending test email...');
    const response = await mailjet
      .post('send', { version: 'v3.1' })
      .request(emailData);
    
    console.log('Email sent successfully:');
    console.log(JSON.stringify(response.body, null, 2));
  } catch (error) {
    console.error('Error in Mailjet test:', error);
  }
}

testMailjet();