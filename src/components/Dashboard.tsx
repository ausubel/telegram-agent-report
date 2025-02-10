import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Message, MedicalAnalytics, TimeAnalytics } from '../types/database';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import { format } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [analytics, setAnalytics] = useState<MedicalAnalytics>({
    symptomCategories: [],
    responseTime: 0,
    totalConsultations: 0,
    activeUsers: 0,
    commonSymptoms: []
  });
  const [timeAnalytics, setTimeAnalytics] = useState<TimeAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const analyzeMessages = (messages: Message[]) => {
    console.log('Analyzing messages:', messages.length);
    
    // Filtrar mensajes que no son del BOT para analizar las consultas de usuarios
    const userMessages = messages.filter(msg => msg.sender_id !== 'BOT');
    
    // Análisis de categorías de síntomas basado en el contenido del mensaje
    const categories = userMessages.reduce((acc, msg) => {
      if (!msg.message_content) return acc;
      
      const content = msg.message_content.toLowerCase();
      if (content.includes('dolor')) {
        acc.push({ category: 'Dolor', count: 1 });
      } else if (content.includes('fiebre')) {
        acc.push({ category: 'Fiebre', count: 1 });
      } else if (content.includes('tos')) {
        acc.push({ category: 'Tos', count: 1 });
      } else if (content.includes('alergia')) {
        acc.push({ category: 'Alergias', count: 1 });
      } else {
        acc.push({ category: 'Otros', count: 1 });
      }
      return acc;
    }, [] as { category: string; count: number }[]);

    console.log('Categories:', categories);

    // Agrupar y contar por categoría
    const symptomCategories = Object.values(
      categories.reduce((acc, { category, count }) => {
        if (!acc[category]) {
          acc[category] = { category, count: 0 };
        }
        acc[category].count += count;
        return acc;
      }, {} as Record<string, { category: string; count: number }>)
    );

    // Análisis de tiempo de respuesta promedio (entre mensaje de usuario y respuesta del bot)
    const responseTimings = messages.reduce((acc, msg, i, arr) => {
      if (i === 0) return acc;
      const currentMsg = msg;
      const prevMsg = arr[i - 1];
      
      // Solo calculamos el tiempo de respuesta cuando es una respuesta del bot a un usuario
      if (currentMsg.sender_id === 'BOT' && prevMsg.sender_id !== 'BOT') {
        const timeDiff = new Date(currentMsg.created_at).getTime() - new Date(prevMsg.created_at).getTime();
        acc.push(timeDiff);
      }
      return acc;
    }, [] as number[]);

    const avgResponseTime = responseTimings.length > 0
      ? responseTimings.reduce((a, b) => a + b, 0) / responseTimings.length
      : 0;

    // Análisis por hora del día (solo mensajes de usuarios)
    const hourlyData = userMessages.reduce((acc, msg) => {
      const hour = new Date(msg.created_at).getHours();
      if (!acc[hour]) {
        acc[hour] = { hour, consultations: 0 };
      }
      acc[hour].consultations++;
      return acc;
    }, {} as Record<number, TimeAnalytics>);

    const sortedTimeAnalytics = Object.values(hourlyData).sort((a, b) => a.hour - b.hour);
    console.log('Time analytics:', sortedTimeAnalytics);

    setTimeAnalytics(sortedTimeAnalytics);
    setAnalytics({
      symptomCategories,
      responseTime: avgResponseTime / 1000, // convertir a segundos
      totalConsultations: userMessages.length,
      activeUsers: new Set(userMessages.map(m => m.sender_id)).size,
      commonSymptoms: ['Dolor', 'Fiebre', 'Tos', 'Alergias'].sort()
    });
  };

  const fetchData = async () => {
    try {
      setError(null);
      console.log('Iniciando fetchData...');
      
      // Verificar la conexión primero
      const { data: healthCheck, error: healthError } = await supabase
        .from('conversation')
        .select('id, sender_id')
        .limit(1);

      if (healthError) {
        console.error('Error de conexión:', healthError);
        setError(`Error de conexión: ${healthError.message}`);
        return;
      }

      console.log('Health check result:', healthCheck);

      // Intentar obtener solo los IDs primero
      const { data: idCheck, error: idError } = await supabase
        .from('conversation')
        .select('id');

      if (idError) {
        console.error('Error al verificar IDs:', idError);
        setError(`Error al verificar IDs: ${idError.message}`);
        return;
      }

      console.log('Total de registros encontrados:', idCheck?.length || 0);

      // Si tenemos IDs, procedemos a obtener los datos completos
      if (idCheck && idCheck.length > 0) {
        const { data, error } = await supabase
          .from('conversation')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error al obtener mensajes:', error);
          setError(`Error al obtener mensajes: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.error('No se encontraron datos completos');
          setError('No se encontraron mensajes completos en la base de datos');
          return;
        }

        console.log('Datos obtenidos:', {
          totalMensajes: data.length,
          primerMensaje: data[0],
          ultimoMensaje: data[data.length - 1]
        });

        setMessages(data);
        analyzeMessages(data);
      } else {
        console.log('No se encontraron registros en la tabla conversation');
        setError('No se encontraron mensajes en la base de datos');
      }
    } catch (error) {
      console.error('Error inesperado:', error);
      setError(error instanceof Error ? error.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Panel de Análisis Médico</h1>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Estadísticas Generales */}
          <div className="bg-white overflow-hidden shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Estadísticas Generales</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Total de Consultas</p>
                <p className="text-2xl font-bold text-indigo-600">{analytics.totalConsultations}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Usuarios Activos</p>
                <p className="text-2xl font-bold text-indigo-600">{analytics.activeUsers}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tiempo de Respuesta Promedio</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {analytics.responseTime.toFixed(2)}s
                </p>
              </div>
            </div>
          </div>

          {/* Gráfico de Categorías de Síntomas */}
          <div className="bg-white overflow-hidden shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Categorías de Síntomas</h2>
            <div className="h-64">
              {analytics.symptomCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.symptomCategories}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {analytics.symptomCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos de síntomas disponibles
                </div>
              )}
            </div>
          </div>

          {/* Gráfico de Actividad por Hora */}
          <div className="bg-white overflow-hidden shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actividad por Hora</h2>
            <div className="h-64">
              {timeAnalytics.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(hour) => `${hour}:00`}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="consultations" 
                      stroke="#8884d8" 
                      name="Consultas"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No hay datos de actividad disponibles
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Últimas Consultas */}
        <div className="bg-white overflow-hidden shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Últimas Consultas</h2>
          <div className="space-y-4">
            {messages.length > 0 ? (
              messages.slice(-5).reverse().map((msg) => (
                <div key={msg.id} className="border-l-4 border-indigo-500 pl-4 py-2">
                  <p className="text-sm text-gray-600">{msg.message_content}</p>
                  <div className="mt-1 flex justify-between text-xs text-gray-400">
                    <span>Usuario: {msg.sender_id}</span>
                    <span>{format(new Date(msg.created_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500">
                No hay consultas disponibles
              </div>
            )}
          </div>
        </div>

        {/* Lista de Usuarios */}
        <div className="bg-white overflow-hidden shadow rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Lista de Usuarios</h2>
          <div className="space-y-2">
            {messages.length > 0 ? (
              Array.from(new Set(messages
                .filter(msg => msg.sender_id !== 'BOT')
                .map(msg => msg.sender_id)))
                .map((userId) => {
                  const userMessages = messages.filter(msg => msg.sender_id === userId);
                  const lastMessage = userMessages[userMessages.length - 1];
                  return (
                    <div key={userId} className="flex items-center justify-between border-b border-gray-200 py-2">
                      <div>
                        <span className="font-medium text-indigo-600">{userId}</span>
                        <p className="text-sm text-gray-500">
                          {userMessages.length} mensajes - Última actividad: {format(new Date(lastMessage.created_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                          Activo
                        </span>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="text-center text-gray-500">
                No hay usuarios registrados
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}