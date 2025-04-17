import Mailjet from 'node-mailjet';

// This script tests just the essential parts of Mailjet email sending
async function essentialMailjetTest() {
  try {
    const apiKey = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    
    if (!apiKey || !secretKey) {
      console.error('Missing Mailjet API keys');
      return;
    }
    
    console.log(`Using Mailjet API key: ${apiKey.substring(0, 4)}...`);
    console.log(`Using Mailjet Secret key: ${secretKey.substring(0, 4)}...`);
    
    // Create Mailjet client
    const mailjet = Mailjet.apiConnect(apiKey, secretKey);
    
    // 1. Check sender status
    console.log('\n=== CHECKING SENDER STATUS ===');
    try {
      const sendersResponse = await mailjet
        .get('sender')
        .request();
      
      console.log('Senders found:', sendersResponse.body.Count);
      
      // Check if api@acrdsc.org is in the list and if it's active
      const senders = sendersResponse.body.Data || [];
      const apiSender = senders.find((sender: any) => sender.Email === 'api@acrdsc.org');
      
      if (apiSender) {
        console.log('\napi@acrdsc.org sender details:');
        console.log(JSON.stringify(apiSender, null, 2));
        console.log(`Sender status: ${apiSender.Status}`);
        
        if (apiSender.Status !== 'Active') {
          console.log(`⚠️ WARNING: api@acrdsc.org is not active. Emails won't be delivered until the sender is verified.`);
        }
      } else {
        console.log('\n⚠️ WARNING: api@acrdsc.org not found in sender list.');
      }
    } catch (error) {
      console.error('Error getting senders:', error);
    }
    
    // 2. Send a test email using v3.1 API with detailed debugging
    console.log('\n=== SENDING TEST EMAIL TO USER EMAIL ===');
    await sendTestEmail(mailjet, 'dr.pjlemos@gmail.com', 'User Email Test');
    
    // 3. Send another test email to a different address to compare behavior
    console.log('\n=== SENDING TEST EMAIL TO AN ALTERNATIVE EMAIL ===');
    await sendTestEmail(mailjet, 'admin@example.com', 'Alternative Email Test');
    
    // 4. Test with a different FROM email for comparison
    console.log('\n=== TESTING WITH ALTERNATIVE FROM ADDRESS ===');
    try {
      const senders = (await mailjet.get('sender').request()).body.Data || [];
      const alternativeSenders = senders.filter((s: any) => 
        s.Email !== 'api@acrdsc.org' && s.Status === 'Active');
      
      if (alternativeSenders.length > 0) {
        console.log(`Found ${alternativeSenders.length} alternative active senders`);
        const altSender = alternativeSenders[0];
        console.log(`Using alternative sender: ${altSender.Email}`);
        
        await sendTestEmail(
          mailjet, 
          'dr.pjlemos@gmail.com', 
          'Test from alternative sender',
          altSender.Email
        );
      } else {
        console.log('No alternative active senders available');
      }
    } catch (error) {
      console.error('Error testing alternative sender:', error);
    }
    
  } catch (error) {
    console.error('Error in Mailjet test:', error);
  }
}

// Helper function to send a test email
async function sendTestEmail(
  mailjet: any, 
  recipientEmail: string, 
  subject: string,
  fromEmail = 'api@acrdsc.org'
) {
  try {
    // Prepare email data
    const emailData = {
      Messages: [
        {
          From: {
            Email: fromEmail,
            Name: 'ACRDSC Reservas Test'
          },
          To: [
            {
              Email: recipientEmail,
              Name: recipientEmail.split('@')[0]
            }
          ],
          Subject: subject,
          TextPart: `This is a test email sent to ${recipientEmail}`,
          HTMLPart: `<h3>Test Email to ${recipientEmail}</h3><p>This is a test email sent to diagnose delivery issues.</p><p>Current time: ${new Date().toISOString()}</p>`,
          TrackOpens: 'enabled',
          TrackClicks: 'enabled',
          CustomID: 'Test-' + Date.now() + '-' + Math.floor(Math.random() * 10000)
        }
      ]
    };
    
    console.log(`Sending email to ${recipientEmail} from ${fromEmail}`);
    
    // Send the email
    const response = await mailjet
      .post('send', { version: 'v3.1' })
      .request(emailData);
    
    console.log('API Response:');
    console.log(JSON.stringify(response.body, null, 2));
    
    // Check message status
    const messages = response.body.Messages || [];
    if (messages.length > 0) {
      const firstMessage = messages[0];
      console.log(`Message status: ${firstMessage.Status}`);
      
      if (firstMessage.Status === 'success') {
        console.log('✅ API accepted the email for delivery');
        
        // Get message details for tracking
        if (firstMessage.To && firstMessage.To.length > 0) {
          const recipientInfo = firstMessage.To[0];
          console.log(`Message ID: ${recipientInfo.MessageID}`);
        }
      } else {
        console.log(`⚠️ API returned non-success status: ${firstMessage.Status}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error sending test email to ${recipientEmail}:`, error);
    return false;
  }
}

// Run the test
essentialMailjetTest();