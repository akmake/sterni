import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text3D, Center, useMatcapTexture, Environment, Float, Sparkles, MeshTransmissionMaterial } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import * as THREE from 'three';

// --- קונפיגורציה ---
const FONT_URL = 'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json';

// --- רכיב טקסט קריסטל (ה-404) ---
const CrystalText = () => {
  const mesh = useRef();
  
  return (
    <Center position={[0, 1, 0]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <Text3D 
          font={FONT_URL} 
          size={5} 
          height={2} 
          curveSegments={12} 
          bevelEnabled 
          bevelThickness={0.2} 
          bevelSize={0.1} 
          bevelOffset={0} 
          bevelSegments={5}
          ref={mesh}
        >
          404
          {/* חומר זכוכית מתקדם (Transmission) */}
          <MeshTransmissionMaterial 
            backside
            backsideThickness={1}
            samples={16}
            thickness={2}
            anisotropicBlur={0.1}
            iridescence={1}
            iridescenceIOR={1}
            iridescenceThicknessRange={[0, 1400]}
            clearcoat={1}
            clearcoatRoughness={0}
            envMapIntensity={1}
            chromaticAberration={0.4} // שבירת אור צבעונית (כמו יהלום)
            color="white"
          />
        </Text3D>
      </Float>
    </Center>
  );
};

// --- רכיב מטבעות זהב מרחפים ---
const GoldParticles = ({ count = 40 }) => {
  const mesh = useRef();
  
  // יצירת מיקומים רנדומליים למטבעות
  const particles = new Array(count).fill().map(() => ({
    position: [
      (Math.random() - 0.5) * 20, 
      (Math.random() - 0.5) * 10, 
      (Math.random() - 0.5) * 10
    ],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
    scale: 0.5 + Math.random() * 0.5
  }));

  useFrame((state) => {
    // סיבוב איטי של כל המערכת
    mesh.current.rotation.y = state.clock.getElapsedTime() * 0.05;
  });

  return (
    <group ref={mesh}>
      {particles.map((data, i) => (
        <Float key={i} speed={1 + Math.random()} rotationIntensity={2} floatIntensity={2}>
          <mesh position={data.position} rotation={data.rotation} scale={[data.scale, data.scale, 0.1]}>
            {/* צורת מטבע (צילינדר שטוח) */}
            <cylinderGeometry args={[1, 1, 0.2, 32]} /> 
            <meshStandardMaterial 
              color="#FFD700" // זהב
              metalness={1}
              roughness={0.1}
              envMapIntensity={1}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
};

// --- רקע ותאורה ---
const SceneLighting = () => {
    return (
        <>
            <Environment preset="city" /> {/* השתקפות של עיר על הזכוכית והזהב */}
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
            <pointLight position={[-10, -10, -10]} intensity={1} color="#FFD700" />
        </>
    )
}

export default function NotFoundPage() {
  // אינטראקציה של העכבר עם הרקע
  const handleMouseMove = (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    // אפשר להוסיף כאן לוגיקה אם רוצים להזיז את המצלמה
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] overflow-hidden" onMouseMove={handleMouseMove}>
      
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
          <SceneLighting />
          <CrystalText />
          <GoldParticles />
          
          {/* אפקט נצנצים עדין ברקע */}
          <Sparkles count={100} scale={20} size={4} speed={0.4} opacity={0.5} color="#FFD700" />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-20 pointer-events-none">
        <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-center space-y-6 pointer-events-auto"
        >
            <h2 className="text-3xl font-light text-white tracking-[0.5em] uppercase border-b border-amber-500/50 pb-4 inline-block">
                הדף לא נמצא
            </h2>
            
            <p className="text-gray-400 font-light max-w-md mx-auto">
                הנכס הדיגיטלי שחיפשת אינו זמין כרגע במאגר.
            </p>

            <div className="flex gap-4 justify-center pt-4">
                <Button 
                    asChild 
                    variant="outline"
                    className="border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black transition-all duration-300 tracking-widest uppercase"
                >
                    <Link to="/">
                        חזרה ללובי
                    </Link>
                </Button>
            </div>
        </motion.div>
      </div>
    </div>
  );
}