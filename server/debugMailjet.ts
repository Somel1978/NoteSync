import Mailjet from 'node-mailjet';

// This script implements the systematic debugging steps from the Mailjet examples

async function debugMailjet() {
  try {
    const apiKey = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    
    if (!apiKey || !secretKey) {
      console.error('Missing Mailjet API keys');
      return;
    }
    
    console.log(`Using Mailjet API key: ${apiKey.substring(0, 4)}...`);
    console.log(`Using Mailjet Secret key: ${secretKey.substring(0, 4)}...`);
    
    // 1. Create Mailjet client
    const mailjet = Mailjet.apiConnect(apiKey, secretKey);
    
    // 2. STEP 1: Get all senders to check if they're validated
    console.log('\n=== CHECKING SENDER STATUS ===');
    try {
      const sendersResponse = await mailjet
        .get('sender')
        .request();
      
      console.log('Senders found:', sendersResponse.body.Count);
      console.log('Senders data:');
      console.log(JSON.stringify(sendersResponse.body, null, 2));
      
      // Check if api@acrdsc.org is in the list and if it's active
      const senders = sendersResponse.body.Data;
      const apiSender = senders.find((sender: any) => sender.Email === 'api@acrdsc.org');
      if (apiSender) {
        console.log('\napi@acrdsc.org sender details:');
        console.log(JSON.stringify(apiSender, null, 2));
        console.log(`Sender status: ${apiSender.Status}`);
        
        if (apiSender.Status !== 'Active') {
          console.log('\n⚠️ WARNING: api@acrdsc.org is not active. Emails won\'t be delivered until the sender is verified.');
        }
      } else {
        console.log('\n⚠️ WARNING: api@acrdsc.org not found in sender list. This email cannot be used to send messages.');
      }
    } catch (error) {
      console.error('Error getting senders:', error);
    }
    
    // 3. STEP 2: Send a test email
    console.log('\n=== SENDING TEST EMAIL ===');
    const testEmail = 'dr.pjlemos@gmail.com';
    const fromEmail = 'api@acrdsc.org';
    const fromName = 'ACRDSC Reservas Debug';
    
    try {
      // First check if we have a valid sender, if not use the first active one
      const sendersResponse = await mailjet
        .get('sender')
        .request();
      
      const senders = sendersResponse.body.Data;
      const activeSender = senders.find((sender: any) => sender.Status === 'Active');
      
      // If api@acrdsc.org is not active, use the first active sender we find
      let actualFromEmail = fromEmail;
      if (!senders.find((sender: any) => sender.Email === fromEmail && sender.Status === 'Active')) {
        if (activeSender) {
          actualFromEmail = activeSender.Email;
          console.log(`Using active sender instead: ${actualFromEmail}`);
        } else {
          console.log('No active senders found! Email will likely fail.');
        }
      }
      
      // Prepare email data using v3 API (older format from example)
      const emailData = {
        FromEmail: actualFromEmail,
        FromName: fromName,
        Subject: 'Mailjet Debug Test',
        'Text-part': 'This is a test email sent from the debugMailjet script to diagnose delivery issues.',
        'Html-part': '<h3>Mailjet Debug Test</h3><p>This is a test email sent from the debugMailjet script to diagnose delivery issues.</p>',
        Recipients: [{ Email: testEmail }]
      };
      
      console.log('Sending test email with data:', JSON.stringify(emailData));
      
      const response = await mailjet
        .post('send')
        .request(emailData);
      
      console.log('Email sent successfully:');
      console.log(JSON.stringify(response.body, null, 2));
      
      // Extract message ID for tracking
      if (response.body.Sent && response.body.Sent.length > 0) {
        const messageId = response.body.Sent[0].MessageID;
        console.log(`Message ID for tracking: ${messageId}`);
        
        // 4. STEP 3: Check message status
        console.log('\n=== CHECKING MESSAGE STATUS ===');
        try {
          // Wait a moment for the message to be processed
          console.log('Waiting 5 seconds before checking message status...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const messageResponse = await mailjet
            .get('message')
            .id(messageId)
            .request();
          
          console.log('Message status:');
          console.log(JSON.stringify(messageResponse.body, null, 2));
          
          // Check if message was delivered
          const messageData = messageResponse.body.Data[0];
          console.log(`Message status: ${messageData.Status}`);
          
          if (messageData.Status === 'sent') {
            console.log('✅ Message was sent successfully!');
          } else {
            console.log(`⚠️ Message status indicates issue: ${messageData.Status}`);
          }
        } catch (error) {
          console.error('Error checking message status:', error);
        }
      }
    } catch (error) {
      console.error('Error sending test email:', error);
    }
  } catch (error) {
    console.error('Error in Mailjet debug:', error);
  }
}

// Run the debug function
debugMailjet();