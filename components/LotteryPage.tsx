import React, { useState, useMemo, useEffect, useCallback } from 'react';
// MODIFICATION: Import AppState from the correct central types file.
import type { LotterySet, Prize, User, PrizeInstance, AppState } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, TreasureChestIcon, StackedCoinIcon } from './icons';
import { sha256 } from '../utils/crypto';
import { TicketBoard } from './TicketBoard';
import { DrawControlPanel } from './DrawControlPanel';
import { ProductCard } from './ProductCard';
import { QueueStatusPanel } from './QueueStatusPanel';
import { RechargeModal } from './RechargeModal';
import { WinnersList } from './WinnersList';

interface LotteryPageProps {
  lotterySet: LotterySet;
  state: AppState;
  actions: any; 
  onSelectLottery: (lottery: LotterySet) => void;
  onBack: () => void;
}

interface VerificationData {
    secretKey: string;
    drawHash: string;
}

const DrawResultModal: React.FC<{ prizes: PrizeInstance[]; verificationData: VerificationData | null; onClose: () => void }> = ({ prizes, verificationData, onClose }) => {
    const [localHash, setLocalHash] = useState('');
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        if (verificationData) {
            sha256(verificationData.secretKey).then(hash => {
                setLocalHash(hash);
                setIsVerified(hash === verificationData.drawHash);
            });
        }
    }, [verificationData]);

    const groupedPrizes = useMemo(() => {
        if (!prizes) return [];

        const prizeMap = new Map<string, { prize: PrizeInstance; count: number }>();
        prizes.forEach(prize => {
            const existing = prizeMap.get(prize.id);
            if (existing) {
                existing.count++;
            } else {
                prizeMap.set(prize.id, { prize: prize, count: 1 });
            }
        });
        return Array.from(prizeMap.values());
    }, [prizes]);


    if (!prizes || prizes.length === 0) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 m-4 max-w-lg w-full max-h-[90vh] transform transition-all duration-300 scale-95 animate-modal-pop" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-4">
                    <h2 className="text-3xl font-extrabold text-black">恭喜您抽中！</h2>
                    <p className="text-gray-500">{prizes.length} 個獎品</p>
                </div>
                <div className="overflow-y-auto max-h-[60vh] pr-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {groupedPrizes.map(({ prize, count }) => (
                            <div key={prize.id} className="relative flex flex-col items-center text-center p-2 rounded-lg bg-gray-50">
                                {count > 1 && (
                                    <div className="absolute top-0 right-0 bg-[#ffc400] text-black text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-md z-10">
                                        x{count}
                                    </div>
                                )}
                                <img src={prize.imageUrl} alt={prize.name} className="w-24 h-24 object-cover rounded-md mb-2 shadow" loading="lazy"/>
                                <p className="text-sm font-semibold text-gray-800 leading-tight">{prize.grade} - {prize.name}</p>
                            </div>
                        ))}
                    </div>
                </div>
                {verificationData && (
                    <div className="mt-4 pt-4 border-t text-xs text-gray-500 font-mono space-y-2">
                        <p className="font-semibold text-gray-600 text-sm mb-2">公平性驗證資料</p>
                        <div>
                            <p><strong>Draw Hash (事前承諾):</strong></p>
                            <p className="break-all text-gray-700">{verificationData.drawHash}</p>
                        </div>
                        <div>
                            <p><strong>Secret Key (您的金鑰):</strong></p>
                            <p className="break-all text-gray-700">{verificationData.secretKey}</p>
                        </div>
                        <div>
                            <p><strong>本地驗證 Hash (由金鑰計算):</strong></p>
                            <p className={`break-all ${isVerified ? 'text-green-600' : 'text-red-600'}`}>{localHash}</p>
                        </div>
                        {isVerified ? <p className="text-green-600 font-bold text-center">✓ 驗證成功</p> : <p className="text-red-600 font-bold text-center">✗ 驗證失敗</p>}
                    </div>
                )}
                <div className="mt-6 text-center">
                    <button onClick={onClose} className="bg-[#ffc400] text-black font-bold py-2 px-6 rounded-lg shadow-md hover:bg-yellow-400 transition-colors border-2 border-black">
                        關閉
                    </button>
                </div>
            </div>
        </div>
    );
};

const ImageGallery: React.FC<{ mainImage: string; prizes: Prize[] }> = ({ mainImage, prizes }) => {
    const galleryImages = useMemo(() => [
        { id: 'main', url: mainImage, name: '主圖' },
        ...prizes.map(p => ({ id: p.id, url: p.imageUrl, name: `${p.grade} - ${p.name}` }))
    ], [mainImage, prizes]);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const selectedImage = galleryImages[selectedIndex];

    const handleNext = useCallback(() => setSelectedIndex((prev) => (prev + 1) % galleryImages.length), [galleryImages.length]);
    const handlePrev = useCallback(() => setSelectedIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length), [galleryImages.length]);
    const handleThumbnailClick = (index: number) => setSelectedIndex(index);

    useEffect(() => setSelectedIndex(0), [galleryImages.length]);

    return (
        <div>
            <div className="relative aspect-video rounded-lg overflow-hidden shadow-lg group">
                <img src={selectedImage.url} alt={selectedImage.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
                <button onClick={handlePrev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 rounded-full p-2 text-gray-800 hover:bg-white transition-opacity duration-300 opacity-0 group-hover:opacity-100 z-10">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button onClick={handleNext} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 rounded-full p-2 text-gray-800 hover:bg-white transition-opacity duration-300 opacity-0 group-hover:opacity-100 z-10">
                    <ChevronRightIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="mt-4">
                <div className="grid grid-cols-5 gap-2">
                    {galleryImages.map((image, index) => (
                        <button key={image.id} onClick={() => handleThumbnailClick(index)} className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${selectedIndex === index ? 'border-yellow-500 ring-2 ring-yellow-300' : 'border-transparent hover:border-yellow-400'}`}>
                            <img src={image.url} alt={image.name} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const LotteryPage: React.FC<LotteryPageProps> = ({ lotterySet, state, actions, onSelectLottery, onBack }) => {
    const [selectedTickets, setSelectedTickets] = useState<number[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawResult, setDrawResult] = useState<PrizeInstance[] | null>(null);
    const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
    const [drawHash, setDrawHash] = useState<string>('');
    const [secretKey, setSecretKey] = useState('');
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);

    const { currentUser, lotteryQueues, ticketLocks, lotterySets, orders, users, inventory } = state;
    const queue = lotteryQueues[lotterySet.id] || [];
    const myQueueIndex = currentUser ? queue.findIndex(e => e.userId === currentUser.id) : -1;
    const amIActive = myQueueIndex === 0;

    const remainingTickets = useMemo(() => {
        const total = lotterySet.prizes.filter(p => p.type === 'NORMAL').reduce((sum, p) => sum + p.total, 0);
        return total - lotterySet.drawnTicketIndices.length;
    }, [lotterySet]);

    const totalTickets = useMemo(() => {
        return lotterySet.prizes.filter(p => p.type === 'NORMAL').reduce((sum, p) => sum + p.total, 0);
    }, [lotterySet.prizes]);

    const isSoldOut = lotterySet.status === 'SOLD_OUT' || remainingTickets === 0;
    
    useEffect(() => {
        if (amIActive || !currentUser) {
            const key = `secret-${lotterySet.id}-${currentUser?.id || 'guest'}-${Date.now()}`;
            setSecretKey(key);
            sha256(key).then(setDrawHash);
        }
    }, [amIActive, lotterySet.id, currentUser]);

    const handleDraw = useCallback(async () => {
        if (selectedTickets.length === 0 || !currentUser || !amIActive) return;

        setIsDrawing(true);
        const effectivePrice = lotterySet.discountPrice || lotterySet.price;
        const cost = selectedTickets.length * effectivePrice;
        
        const result = await actions.draw(lotterySet.id, selectedTickets, cost, drawHash, secretKey);
        setIsDrawing(false);

        if (result.success) {
            setDrawResult(result.drawnPrizes);
            setVerificationData({ secretKey, drawHash });
            setSelectedTickets([]);
        } else {
            alert(result.message || '抽獎失敗，請稍後再試。');
        }
    }, [actions, lotterySet, selectedTickets, currentUser, amIActive, drawHash, secretKey]);
    

    const handleLockTickets = useCallback((selected: number[]) => {
        const myLocked = ticketLocks.filter(l => l.userId === currentUser?.id && l.lotteryId === lotterySet.id).map(l => l.ticketIndex);
        const toLock = selected.filter(s => !myLocked.includes(s));
        const toUnlock = myLocked.filter(m => !selected.includes(m));
        
        if (toLock.length > 0) actions.lockOrUnlockTickets(lotterySet.id, toLock, 'lock');
        if (toUnlock.length > 0) actions.lockOrUnlockTickets(lotterySet.id, toUnlock, 'unlock');
        setSelectedTickets(selected);
    }, [actions, lotterySet.id, currentUser, ticketLocks]);

    const effectivePrice = lotterySet.discountPrice || lotterySet.price;
    const hasDiscount = !!lotterySet.discountPrice;

    const recommendedSets = useMemo(() => {
        return lotterySets
            .filter(set => set.id !== lotterySet.id && set.status === 'AVAILABLE')
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
    }, [lotterySets, lotterySet.id]);
    
    const winnersOrders = useMemo(() => {
        return orders.filter(order => order.lotterySetTitle === lotterySet.title);
    }, [orders, lotterySet.title]);

    return (
        <>
            <RechargeModal 
                isOpen={isRechargeModalOpen}
                onClose={() => setIsRechargeModalOpen(false)}
                onConfirmPurchase={actions.rechargePoints}
                currentUserPoints={currentUser?.points || 0}
            />
            {drawResult && (
                <DrawResultModal prizes={drawResult} verificationData={verificationData} onClose={() => setDrawResult(null)} />
            )}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
                <div className="relative mb-6">
                    <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center text-gray-700 hover:text-black font-semibold transition-colors z-10">
                        <ChevronLeftIcon className="h-6 w-6" />
                        <span>返回首頁</span>
                    </button>
                    <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-800 truncate px-20">{lotterySet.title}</h1>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <ImageGallery mainImage={lotterySet.imageUrl} prizes={lotterySet.prizes} />
                        
                        <div>
                            <h2 className="text-3xl font-extrabold text-gray-900">{lotterySet.title}</h2>
                            <p className="text-sm text-gray-500 mt-1">編號: {lotterySet.id}</p>
                            
                            <div className="mt-4 flex items-center gap-4 p-4 rounded-lg bg-slate-100">
                                <StackedCoinIcon className="w-8 h-8 text-yellow-500" />
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm">單抽:</span>
                                    {hasDiscount ? (
                                        <>
                                            <span className="text-3xl font-bold text-rose-500">{lotterySet.discountPrice} P</span>
                                            <span className="text-xl text-slate-400 line-through">{lotterySet.price} P</span>
                                        </>
                                    ) : (
                                        <span className="text-3xl font-bold text-black">{lotterySet.price} P</span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t">
                                <div className="flex justify-between items-center text-sm font-semibold text-gray-700 bg-gray-200 px-4 py-2 rounded-t-lg">
                                    <div className="flex items-center gap-2">
                                        <TreasureChestIcon className="w-5 h-5"/>
                                        <span>獎項</span>
                                    </div>
                                    <span>剩餘 / 總量</span>
                                </div>
                                <div className="max-h-60 overflow-y-auto border border-t-0 rounded-b-lg">
                                    {lotterySet.prizes.map((prize) => (
                                        <div key={prize.id} className={`flex justify-between items-center px-4 py-2 text-sm ${prize.type === 'LAST_ONE' ? 'bg-amber-50' : (prize.remaining === 0 ? 'bg-gray-100 text-gray-400' : 'bg-white')} border-b last:border-b-0`}>
                                            <div className="font-medium text-gray-800">
                                                <span className="font-bold mr-2">{prize.grade}</span>
                                                {prize.name}
                                            </div>
                                            <div className="font-mono font-semibold">
                                                {prize.remaining} / {prize.total}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-200">
                      <div className="mb-8">
                        <QueueStatusPanel 
                            lotteryId={lotterySet.id} 
                            queue={queue} 
                            currentUser={currentUser} 
                            onJoinQueue={() => actions.joinQueue(lotterySet.id)} 
                            onLeaveQueue={() => actions.leaveQueue(lotterySet.id)} 
                            onExtendTurn={() => actions.extendTurn(lotterySet.id)} 
                        />
                      </div>
                      <TicketBoard
                          lotteryId={lotterySet.id}
                          totalTickets={totalTickets}
                          drawnTickets={lotterySet.drawnTicketIndices}
                          ticketLocks={ticketLocks}
                          currentUser={currentUser}
                          onTicketSelect={handleLockTickets}
                          isSoldOut={isSoldOut}
                          isLocked={!amIActive}
                          prizes={lotterySet.prizes}
                          prizeOrder={lotterySet.prizeOrder}
                      />
                      <DrawControlPanel
                          lotteryId={lotterySet.id}
                          price={lotterySet.price}
                          discountPrice={lotterySet.discountPrice}
                          remainingTickets={remainingTickets}
                          selectedTickets={selectedTickets}
                          onTicketSelect={handleLockTickets}
                          currentUser={currentUser}
                          isDrawing={isDrawing}
                          drawHash={drawHash}
                          onDraw={handleDraw}
                          isSoldOut={isSoldOut}
                          totalTickets={totalTickets}
                          drawnTickets={lotterySet.drawnTicketIndices}
                          isLocked={!amIActive}
                          amIActive={amIActive}
                          onRechargeClick={() => setIsRechargeModalOpen(true)}
                      />
                    </div>
                </div>

                {recommendedSets.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-2xl font-bold text-center mb-6">您可能也喜歡</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {recommendedSets.map(lottery => (
                                <ProductCard key={lottery.id} lottery={lottery} onSelect={() => onSelectLottery(lottery)} />
                            ))}
                        </div>
                    </div>
                )}
                
                <WinnersList orders={winnersOrders} users={users} inventory={inventory} />
            </div>
        </>
    );
};