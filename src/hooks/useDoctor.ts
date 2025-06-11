import { useState, useEffect } from 'react';

interface DoctorStats {
  patients: number;
  experience: string;
  rating: number;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  image: string | null;
  stats: DoctorStats;
}

export default function useDoctor() {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDoctorInfo();
  }, []);

  const fetchDoctorInfo = async () => {
    try {
      // Como não temos API real, vamos simular com dados fictícios
      setTimeout(() => {
        const doctorData: Doctor = {
          id: '1',
          name: 'Dr. Carlos Silva',
          specialty: 'Cardiologista',
          image: null,
          stats: {
            patients: 126,
            experience: '12 anos',
            rating: 4.8
          }
        };
        
        setDoctor(doctorData);
        setIsLoading(false);
      }, 1000);
      
      // Quando tiver uma API real:
      // const response = await fetch('sua-api/doctor');
      // const data = await response.json();
      // setDoctor(data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setIsLoading(false);
    }
  };

  return { doctor, isLoading };
}
