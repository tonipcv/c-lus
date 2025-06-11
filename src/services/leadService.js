import apiClient from './apiClient';

// Serviço para manipulação de leads
const leadService = {
  // Listar todos os leads com filtragem e paginação
  getLeads: async (filters = {}) => {
    try {
      return await apiClient.get('/api/leads', filters);
    } catch (error) {
      console.error('Erro ao listar leads:', error);
      return { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    }
  },
  
  // Buscar um lead específico
  getLead: async (id) => {
    try {
      return await apiClient.get(`/api/leads/${id}`);
    } catch (error) {
      console.error(`Erro ao buscar lead ${id}:`, error);
      throw error;
    }
  },
  
  // Atualizar um lead
  updateLead: async (id, data) => {
    try {
      return await apiClient.patch(`/api/leads/${id}`, data);
    } catch (error) {
      console.error(`Erro ao atualizar lead ${id}:`, error);
      throw error;
    }
  },
  
  // Remover um lead
  deleteLead: async (id) => {
    try {
      return await apiClient.delete(`/api/leads/${id}`);
    } catch (error) {
      console.error(`Erro ao remover lead ${id}:`, error);
      throw error;
    }
  },
  
  // Atualizar status de múltiplos leads
  updateLeadsStatus: async (ids, status) => {
    try {
      return await apiClient.put('/api/leads', { ids, status });
    } catch (error) {
      console.error('Erro ao atualizar status de leads:', error);
      throw error;
    }
  },
  
  // Obter anotações médicas de um lead
  getLeadNotes: async (id) => {
    try {
      return await apiClient.get(`/api/leads/${id}/notes`);
    } catch (error) {
      console.error(`Erro ao buscar anotações do lead ${id}:`, error);
      throw error;
    }
  },
  
  // Adicionar/atualizar anotações médicas
  updateLeadNotes: async (id, notes) => {
    try {
      return await apiClient.post(`/api/leads/${id}/notes`, { medicalNotes: notes });
    } catch (error) {
      console.error(`Erro ao atualizar anotações do lead ${id}:`, error);
      throw error;
    }
  }
};

export default leadService; 