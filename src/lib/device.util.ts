export const getDeviceType = (userAgent: string): 'mobile' | 'desktop' => {
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  return mobileRegex.test(userAgent) ? 'mobile' : 'desktop';
};