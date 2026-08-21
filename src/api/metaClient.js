const META_API_URL = 'https://graph.facebook.com/v19.0';

export const metaClient = {
  /**
   * Verify if the provided user token is valid
   */
  async verifyToken(token) {
    try {
      const response = await fetch(`${META_API_URL}/me?access_token=${token}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data; // Returns { name, id }
    } catch (error) {
      console.error('Meta API Verify Token Error:', error);
      throw error;
    }
  },

  /**
   * Fetch Business Pages the user manages
   */
  async getPages(token) {
    try {
      const response = await fetch(`${META_API_URL}/me/accounts?access_token=${token}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.data || []; // Returns array of { id, name, category, access_token }
    } catch (error) {
      console.error('Meta API Get Pages Error:', error);
      throw error;
    }
  },

  /**
   * Fetch Ad Accounts linked to the user
   */
  async getAdAccounts(token) {
    try {
      const response = await fetch(`${META_API_URL}/me/adaccounts?fields=name,account_status,currency&access_token=${token}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.data || [];
    } catch (error) {
      console.error('Meta API Get Ad Accounts Error:', error);
      throw error;
    }
  },

  /**
   * Get active campaigns with basic insights for a given Ad Account
   */
  async getCampaigns(token, adAccountId) {
    try {
      const response = await fetch(
        `${META_API_URL}/${adAccountId}/campaigns?fields=name,status,objective,insights{spend,clicks}&access_token=${token}`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      return (data.data || []).map(campaign => {
        const insights = campaign.insights?.data?.[0] || {};
        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status === 'ACTIVE' ? 'Active' : 'Paused',
          spend: parseFloat(insights.spend || 0),
          leads: parseInt(insights.clicks || 0), // Mocking leads as clicks if objective isn't leadgen
          cpl: insights.spend ? Math.round(insights.spend / (insights.clicks || 1)) : 0,
          platform: 'Meta Ads'
        };
      });
    } catch (error) {
      console.error('Meta API Get Campaigns Error:', error);
      return []; // Return empty gracefully
    }
  },

  /**
   * Get raw leads from Facebook Forms attached to a Page
   * Note: This requires the PAGE ACCESS TOKEN, not the User Access Token
   */
  async getLeads(pageAccessToken, pageId) {
    try {
      // First get forms
      const formsRes = await fetch(`${META_API_URL}/${pageId}/leadgen_forms?access_token=${pageAccessToken}`);
      const formsData = await formsRes.json();
      if (formsData.error) throw new Error(formsData.error.message);
      
      let allLeads = [];
      const forms = formsData.data || [];

      // Fetch leads for each form
      for (const form of forms) {
        const leadsRes = await fetch(`${META_API_URL}/${form.id}/leads?fields=created_time,field_data,ad_name,campaign_name&access_token=${pageAccessToken}`);
        const leadsData = await leadsRes.json();
        
        if (leadsData.data) {
           const parsedLeads = leadsData.data.map(lead => {
              // field_data is array of {name, values}
              const nameField = lead.field_data.find(f => f.name === 'full_name' || f.name === 'first_name');
              const phoneField = lead.field_data.find(f => f.name.includes('phone'));
              
              // Extract all other questions
              const formData = {};
              lead.field_data.forEach(f => {
                 if (f.name !== 'full_name' && f.name !== 'first_name' && !f.name.includes('phone')) {
                    formData[f.name] = f.values[0];
                 }
              });
              
              return {
                 id: lead.id,
                 name: nameField ? nameField.values[0] : 'Yangi Lid (FB)',
                 phone: phoneField ? phoneField.values[0] : '',
                 source: `Facebook Ads (${form.name})`,
                 ad_name: lead.ad_name || '',
                 campaign_name: lead.campaign_name || '',
                 form_data: formData,
                 created_date: lead.created_time
              };
           });
           allLeads = [...allLeads, ...parsedLeads];
        }
      }
      
      // Sort by newest
      return allLeads.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    } catch (error) {
      console.error('Meta API Get Leads Error:', error);
      return []; // Return empty gracefully
    }
  }
};
