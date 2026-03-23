export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { email, password } = req.body;

    // LOGIN TEMPORAL
    if (email === 'admin@test.com' && password === '1234') {
      return res.status(200).json({
        token: 'fake-token-123',
        user: {
          id: 1,
          name: 'Administrador',
          email: 'admin@test.com',
          role: 'admin'
        }
      });
    }

    return res.status(401).json({
      message: 'Credenciales inválidas'
    });

  } catch (error) {
    return res.status(500).json({
      message: 'Error interno',
      error: error.message
    });
  }
}
