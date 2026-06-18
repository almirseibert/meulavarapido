import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, G, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';

/**
 * Logomarca "Meu LavaRápido": gota d'água com um carro estilizado dentro + brilho.
 * Desenhada em SVG (nítida em qualquer tela).
 */
export function LogoMark({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="drop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#22d3ee" />
          <Stop offset="1" stopColor="#0891b2" />
        </LinearGradient>
      </Defs>

      {/* gota d'água */}
      <Path d="M50 6 C50 6 80 40 80 62 a30 30 0 1 1 -60 0 C20 40 50 6 50 6 Z" fill="url(#drop)" />
      {/* brilho/reflexo da água */}
      <Ellipse cx={39} cy={40} rx={6} ry={11} fill="#ffffff" opacity={0.18} />
      <Circle cx={34} cy={30} r={2.4} fill="#ffffff" opacity={0.5} />

      {/* carro */}
      <G>
        {/* corpo */}
        <Path d="M24 64 q0 -4 4 -4 h44 q4 0 4 4 v4 q0 4 -4 4 h-44 q-4 0 -4 -4 z" fill="#ffffff" />
        {/* cabine */}
        <Path d="M39 60 C 39 52.5 44 49.5 50 49.5 C 56 49.5 61 52.5 61 60 Z" fill="#ffffff" />
        {/* para-brisa */}
        <Path d="M43 59 C 43 54.8 46 53 50 53 C 54 53 57 54.8 57 59 Z" fill="#a5f3fc" />
        {/* farol */}
        <Circle cx={72} cy={65} r={1.7} fill="#fde68a" />
        {/* rodas */}
        <Circle cx={37} cy={72} r={5} fill="#0B4F6C" />
        <Circle cx={37} cy={72} r={2} fill="#ffffff" />
        <Circle cx={63} cy={72} r={5} fill="#0B4F6C" />
        <Circle cx={63} cy={72} r={2} fill="#ffffff" />
      </G>

      {/* bolhas */}
      <Circle cx={26} cy={44} r={3.4} fill="#ffffff" opacity={0.9} />
      <Circle cx={74} cy={48} r={2.6} fill="#ffffff" opacity={0.9} />
    </Svg>
  );
}

/** Logo completa: marca + texto "Meu LavaRápido". */
export function Logo({ size = 64, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <View className="items-center">
      <LogoMark size={size} />
      <View className="flex-row items-baseline mt-2">
        <Text style={{ fontSize: size * 0.34 }} className={`font-semibold ${dark ? 'text-white' : 'text-brand-900'}`}>
          Meu{' '}
        </Text>
        <Text style={{ fontSize: size * 0.34 }} className="font-bold text-brand-500">
          Lava
        </Text>
        <Text style={{ fontSize: size * 0.34 }} className={`font-bold ${dark ? 'text-white' : 'text-brand-900'}`}>
          Rápido
        </Text>
      </View>
    </View>
  );
}
