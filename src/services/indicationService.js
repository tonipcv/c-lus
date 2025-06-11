import apiClient from './apiClient';

// Service for indication manipulation
const indicationService = {
  // List all indications
  getIndications: async (withStats = false, period = 'month') => {
    try {
      return await apiClient.get('/api/indications', { withStats, period });
    } catch (error) {
      console.error('Error listing indications:', error);
      return [];
    }
  },
  
  // Create a new indication
  createIndication: async (data) => {
    try {
      return await apiClient.post('/api/indications', data);
    } catch (error) {
      console.error('Error creating indication:', error);
      throw error;
    }
  },
  
  // Get indication details
  getIndication: async (slug) => {
    try {
      return await apiClient.get(`/api/indications/${slug}`);
    } catch (error) {
      console.error(`Error fetching indication ${slug}:`, error);
      throw error;
    }
  },
  
  // Update an indication
  updateIndication: async (slug, data) => {
    try {
      return await apiClient.put(`/api/indications/${slug}`, data);
    } catch (error) {
      console.error(`Error updating indication ${slug}:`, error);
      throw error;
    }
  },
  
  // Get indication statistics
  getIndicationStats: async (period = 'month') => {
    try {
      return await apiClient.get('/api/indications/stats', { period });
    } catch (error) {
      console.error('Error fetching indication statistics:', error);
      return {
        overall: {
          totalIndications: 0,
          totalClicks: 0,
          totalLeads: 0,
          overallConversionRate: 0,
          period
        },
        indications: [],
        dailyStats: { clicks: [], leads: [] }
      };
    }
  },
  
  // Generate indication link
  generateIndicationLink: async (data) => {
    try {
      return await apiClient.post('/api/indications/generate-link', data);
    } catch (error) {
      console.error('Error generating indication link:', error);
      throw error;
    }
  }
};

export default indicationService; 