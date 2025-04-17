import Mailjet from 'node-mailjet';

// This script implements comprehensive testing for Mailjet using v3.1 API
async function completeMailjetTest() {
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
    
    // 1. Check account status
    console.log('\n=== CHECKING ACCOUNT STATUS ===');
    try {
      const myAccountResponse = await mailjet
        .get('myaccount')
        .request();
      
      console.log('Account status:');
      console.log(JSON.stringify(myAccountResponse.body, null, 2));
      
      // See if there are any account restrictions
      const accountData = myAccountResponse.body.Data ? myAccountResponse.body.Data[0] : null;
      if (accountData && accountData.Status) {
        console.log(`Account status: ${accountData.Status}`);
        
        if (accountData.Status !== 'Active') {
          console.log(`⚠️ WARNING: Account is not active (${accountData.Status}). This could prevent email delivery.`);
        }
      }
    } catch (error) {
      console.error('Error getting account status:', error);
    }
    
    // 2. Check sender status (domain & email)
    console.log('\n=== CHECKING DOMAIN STATUS ===');
    try {
      const domainsResponse = await mailjet
        .get('sender/domain')
        .request();
      
      console.log('Domains:');
      console.log(JSON.stringify(domainsResponse.body, null, 2));
      
      const domains = domainsResponse.body.Data || [];
      const acrdscDomain = domains.find((domain: any) => domain.Name === 'acrdsc.org');
      
      if (acrdscDomain) {
        console.log('\nacrdsc.org domain details:');
        console.log(JSON.stringify(acrdscDomain, null, 2));
        console.log(`Domain status: ${acrdscDomain.Status}`);
        
        if (acrdscDomain.Status !== 'Active') {
          console.log(`⚠️ WARNING: acrdsc.org domain is not active. This could affect email delivery.`);
        }
        if (!acrdscDomain.SPFValid) {
          console.log(`⚠️ WARNING: SPF record for acrdsc.org is not valid. This could affect email delivery.`);
        }
        if (!acrdscDomain.DKIMValid) {
          console.log(`⚠️ WARNING: DKIM for acrdsc.org is not valid. This could affect email delivery.`);
        }
      } else {
        console.log('Domain acrdsc.org not found');
      }
    } catch (error) {
      console.error('Error checking domain status:', error);
    }
    
    console.log('\n=== CHECKING SENDER STATUS ===');
    try {
      const sendersResponse = await mailjet
        .get('sender')
        .request();
      
      console.log('Senders found:', sendersResponse.body.Count);
      console.log('Senders data:');
      console.log(JSON.stringify(sendersResponse.body, null, 2));
      
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
    
    // 3. Send a test email using v3.1 API
    console.log('\n=== SENDING TEST EMAIL (V3.1 API) ===');
    const testEmail = 'dr.pjlemos@gmail.com';
    const fromEmail = 'api@acrdsc.org';
    const fromName = 'ACRDSC Reservas Test';
    
    try {
      // Prepare email data using v3.1 API format
      const emailData = {
        Messages: [
          {
            From: {
              Email: fromEmail,
              Name: fromName
            },
            To: [
              {
                Email: testEmail,
                Name: 'Pedro Lemos'
              }
            ],
            Subject: 'Mailjet Test Email (v3.1)',
            TextPart: 'This is a test email sent using Mailjet v3.1 API to diagnose delivery issues.',
            HTMLPart: '<h3>Mailjet Test Email (v3.1)</h3><p>This is a test email sent using Mailjet v3.1 API to diagnose delivery issues.</p>',
            TrackOpens: 'enabled',
            TrackClicks: 'enabled',
            CustomID: 'CompleteTest-' + Date.now()
          }
        ]
      };
      
      console.log('Sending test email with data:', JSON.stringify(emailData, null, 2));
      
      const response = await mailjet
        .post('send', { version: 'v3.1' })
        .request(emailData);
      
      console.log('Email sent successfully:');
      console.log(JSON.stringify(response.body, null, 2));
      
      // Check message status
      const messages = response.body.Messages || [];
      if (messages.length > 0) {
        const firstMessage = messages[0];
        console.log(`Message status: ${firstMessage.Status}`);
        
        if (firstMessage.Status === 'success') {
          console.log('✅ API accepted the email for delivery');
          
          // Get message UUID and ID for tracking
          if (firstMessage.To && firstMessage.To.length > 0) {
            const recipientInfo = firstMessage.To[0];
            console.log(`Message UUID: ${recipientInfo.MessageUUID}`);
            console.log(`Message ID: ${recipientInfo.MessageID}`);
          }
        } else {
          console.log(`⚠️ API returned non-success status: ${firstMessage.Status}`);
        }
      }
    } catch (error) {
      console.error('Error sending test email:', error);
    }
    
    // 4. Try using the deprecated v3 API as well (for comparison)
    console.log('\n=== SENDING TEST EMAIL (V3 API - DEPRECATED) ===');
    try {
      // Prepare email data using v3 API format
      const legacyEmailData = {
        FromEmail: fromEmail,
        FromName: fromName,
        Subject: 'Mailjet Test Email (v3)',
        'Text-part': 'This is a test email sent using Mailjet v3 API to diagnose delivery issues.',
        'Html-part': '<h3>Mailjet Test Email (v3)</h3><p>This is a test email sent using Mailjet v3 API to diagnose delivery issues.</p>',
        Recipients: [{ Email: testEmail }]
      };
      
      console.log('Sending test email with legacy v3 API:', JSON.stringify(legacyEmailData, null, 2));
      
      const legacyResponse = await mailjet
        .post('send')
        .request(legacyEmailData);
      
      console.log('Legacy email sent successfully:');
      console.log(JSON.stringify(legacyResponse.body, null, 2));
    } catch (error) {
      console.error('Error sending legacy test email:', error);
    }
    
    // 5. Check additional configurations that might affect email delivery
    console.log('\n=== CHECKING ADDITIONAL CONFIGURATIONS ===');
    
    // Check rate limits
    try {
      const rateLimitResponse = await mailjet
        .get('ratelimit')
        .request();
      
      console.log('Rate limit information:');
      console.log(JSON.stringify(rateLimitResponse.body, null, 2));
    } catch (error) {
      console.error('Error checking rate limits:', error);
    }
    
    // Check if there are any blocks or suppressions
    try {
      const suppressionResponse = await mailjet
        .get('suppress')
        .request();
      
      console.log('Suppression information:');
      console.log(JSON.stringify(suppressionResponse.body, null, 2));
      
      // Check if test email is in suppression list
      const suppressions = suppressionResponse.body.Data || [];
      const testEmailSuppressed = suppressions.find((entry: any) => entry.Email === testEmail);
      
      if (testEmailSuppressed) {
        console.log(`⚠️ WARNING: ${testEmail} is in the suppression list. Emails won't be delivered to this address.`);
      }
    } catch (error) {
      console.error('Error checking suppressions:', error);
    }
  } catch (error) {
    console.error('Error in Mailjet test:', error);
  }
}

// Run the test
completeMailjetTest();