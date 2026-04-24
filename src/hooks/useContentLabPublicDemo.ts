import { useQuery } from '@tanstack/react-query';

// Marketing demo placeholder — returns null so the public page renders its built-in fallback.
export const useContentLabPublicDemo = () =>
  useQuery({ queryKey: ['content-lab-public-demo'], queryFn: async () => null });
