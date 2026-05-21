import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRight,
  Edit2,
  Check,
  X,
  Loader2,
  MapPin,
  Tag,
  Phone,
  Coins,
  Store,
  Star,
  Copy,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../lib/hooks/useWallet';
import { useVendor } from '../../lib/hooks/useVendor';
import { useVendorRating } from '../../lib/hooks/useRating';
import { useToast } from '../../lib/hooks/useToast';
import {
  truncateAddress,
  prepareContractTx,
  submitSorobanTx,
  addressToScVal,
  stringToScVal,
} from '../../lib/stellar';
import {
  StellarWalletsKit,
  Networks,
} from '@creit.tech/stellar-wallets-kit';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import { PushPrompt } from '../../components/PushPrompt';
import { useLanguage } from '../../contexts/LanguageContext';

const REGISTRY_ID = import.meta.env
  .VITE_VENDOR_REGISTRY_CONTRACT_ID as string | undefined;

const PRODUCT_TYPES = [
  'fish',
  'meat',
  'vegetables',
  'fruits',
  'rice & grains',
  'spices',
  'other',
];

const PRODUCT_EMOJIS: Record<string, string> = {
  fish: '🐟',
  meat: '🥩',
  vegetables: '🥦',
  fruits: '🍎',
  'rice & grains': '🌾',
  spices: '🌶️',
  other: '🛒',
};

export function VendorProfile() {
  const navigate = useNavigate();
  const { address, disconnect } = useWallet();
  const { vendor, isLoading } = useVendor(address);
  const { summary: ratingSummary } = useVendorRating(address);
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    stallNumber: '',
    phone: '',
    productType: 'fish',
  });

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showDisconnectModal) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [showDisconnectModal]);

  useEffect(() => {
    if (vendor) {
      setForm({
        name: vendor.name,
        stallNumber: vendor.stallNumber,
        phone: vendor.phone,
        productType: vendor.productType,
      });
    }
  }, [vendor]);

  const update =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      showToast(t('profile.addressCopied'), 'success');
    }
  };

  const handleDisconnectConfirm = async () => {
    setIsDisconnecting(true);
    await disconnect();
    setIsDisconnecting(false);
    setShowDisconnectModal(false);
    showToast(t('profile.disconnected'), 'success');
    navigate('/');
  };

  const handleSave = async () => {
    if (!address || !REGISTRY_ID) return;

    setSaving(true);

    try {
      const xdr = await prepareContractTx(
        address,
        REGISTRY_ID,
        'update_profile',
        [
          addressToScVal(address),
          stringToScVal(form.name),
          stringToScVal(form.stallNumber),
          stringToScVal(form.phone),
          stringToScVal(form.productType),
        ]
      );

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(
        xdr,
        {
          networkPassphrase: Networks.TESTNET,
          address,
        }
      );

      await submitSorobanTx(signedTxXdr);

      showToast(t('profile.updateSuccess'), 'success');

      setEditing(false);
    } catch (err: unknown) {
      showToast(
        (err as { message?: string }).message ??
          t('profile.updateFailed'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const emoji = vendor
    ? PRODUCT_EMOJIS[vendor.productType] ?? '🛒'
    : '🛒';

  if (!address) {
    return (
      <WalletRequiredState
        detail={t('profile.connectWalletDetail')}
      />
    );
  }

  return (
    <>
      <div className="space-y-4 animate-page-in max-w-md pb-8">
        {/* ── PROFILE HERO ── */}
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{ backgroundColor: '#00284B' }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              top: -40,
              right: -40,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(20,184,166,0.28) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />

          <div className="relative p-5">
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl skeleton shrink-0" />

                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 skeleton rounded" />
                  <div className="h-3 w-20 skeleton rounded" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {emoji}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="font-black text-white text-lg leading-tight truncate"
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {vendor?.name || t('profile.vendor')}
                  </p>

                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {vendor?.productType && (
                      <span
                        className="text-xs font-medium capitalize"
                        style={{ color: '#14B8A6' }}
                      >
                        {vendor.productType}
                      </span>
                    )}

                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={
                        vendor?.isActive
                          ? {
                              backgroundColor:
                                'rgba(74,222,128,0.15)',
                              color: '#4ADE80',
                            }
                          : {
                              backgroundColor:
                                'rgba(248,113,113,0.15)',
                              color: '#F87171',
                            }
                      }
                    >
                      <span
                        className={`w-1 h-1 rounded-full ${
                          vendor?.isActive
                            ? 'animate-pulse'
                            : ''
                        }`}
                        style={{
                          backgroundColor: vendor?.isActive
                            ? '#4ADE80'
                            : '#F87171',
                        }}
                      />

                      {vendor?.isActive
                        ? t('profile.active')
                        : t('profile.inactive')}
                    </span>
                  </div>

                  <button
                    onClick={handleCopyAddress}
                    className="flex items-center gap-1 mt-1 text-[10px] font-mono transition-colors hover:opacity-70"
                    style={{
                      color: 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {truncateAddress(address)}
                    <Copy size={8} />
                  </button>
                </div>

                <button
                  onClick={() =>
                    setShowDisconnectModal(true)
                  }
                  className="p-2 rounded-xl transition-all active:scale-95 shrink-0"
                  style={{
                    backgroundColor:
                      'rgba(255,255,255,0.08)',
                  }}
                  aria-label={t('profile.disconnect')}
                >
                  <LogOut
                    size={14}
                    style={{
                      color: 'rgba(255,255,255,0.5)',
                    }}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── PUSH NOTIFICATIONS ── */}
        <PushPrompt role="vendor" wallet={address} />

        {/* ── STATS ROW ── */}
        {vendor && (
          <div className="grid grid-cols-2 gap-3">
            <div
              className="bg-white rounded-2xl p-3 text-center"
              style={{ border: '1px solid #F1F5F9' }}
            >
              <p
                className="text-2xl font-black text-slate-900"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {vendor.totalTransactions}
              </p>

              <p className="text-[10px] text-slate-400 font-medium">
                {t('profile.transactions')}
              </p>
            </div>

            <div
              className="bg-white rounded-2xl p-3 text-center"
              style={{ border: '1px solid #F1F5F9' }}
            >
              <p
                className="text-2xl font-black text-slate-900"
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {(
                  Number(vendor.totalVolume) / 10000000
                ).toFixed(1)}
              </p>

              <p className="text-[10px] text-slate-400 font-medium">
                {t('profile.volume')}
              </p>
            </div>
          </div>
        )}

        {/* ── REPUTATION ── */}
        {vendor && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{
              backgroundColor: '#FEFCE8',
              border: '1px solid #FEF08A',
            }}
          >
            <Star
              size={18}
              fill="#FACC15"
              style={{ color: '#FACC15' }}
            />

            <div className="flex-1 min-w-0">
              {ratingSummary &&
              ratingSummary.count > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="font-black text-lg"
                    style={{
                      fontFamily:
                        "'Montserrat', sans-serif",
                      color: '#854D0E',
                    }}
                  >
                    {ratingSummary.average.toFixed(1)}/5
                  </span>

                  <span
                    className="text-[10px]"
                    style={{ color: '#A16207' }}
                  >
                    ({ratingSummary.count}{' '}
                    {t('profile.ratings')})
                  </span>
                </div>
              ) : (
                <p
                  className="text-xs font-medium"
                  style={{ color: '#854D0E' }}
                >
                  {t('profile.noRatingsShort')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── WITHDRAW ── */}
        <a
          href="/customer/cashout"
          className="rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-[0.98] transition-all block"
          style={{
            backgroundColor: 'white',
            border: '1px solid #F1F5F9',
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#F0FDFA' }}
          >
            <Coins
              size={16}
              style={{ color: '#008055' }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {t('profile.withdrawEarnings')}
            </p>

            <p className="text-[10px] text-slate-400 mt-0.5">
              {t('profile.withdrawDesc')}
            </p>
          </div>

          <ArrowRight
            size={14}
            style={{ color: '#CBD5E1' }}
          />
        </a>

        {/* ── STALL DETAILS ── */}
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid #F1F5F9' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">
              {t('profile.stallDetails')}
            </h2>

            {!editing && vendor && REGISTRY_ID && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs font-medium transition-colors active:opacity-60"
                style={{ color: '#008055' }}
              >
                <Edit2 size={12} />
                {t('profile.edit')}
              </button>
            )}
          </div>

          <div className="p-4">
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl skeleton shrink-0" />

                    <div className="flex-1 space-y-1">
                      <div className="h-2 w-16 skeleton rounded" />
                      <div className="h-3 w-24 skeleton rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !vendor && (
              <div className="text-center py-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{
                    backgroundColor: REGISTRY_ID
                      ? '#F0FDFA'
                      : '#FFFBEB',
                  }}
                >
                  {REGISTRY_ID ? (
                    <Store
                      size={22}
                      style={{ color: '#008055' }}
                    />
                  ) : (
                    <AlertTriangle
                      size={22}
                      style={{ color: '#D97706' }}
                    />
                  )}
                </div>

                <p className="text-sm font-bold text-slate-700 mb-1">
                  {REGISTRY_ID
                    ? t('profile.noProfile')
                    : t(
                        'profile.registryUnavailable'
                      )}
                </p>

                {REGISTRY_ID && (
                  <button
                    onClick={() =>
                      navigate('/vendor/apply')
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl mt-2 text-white"
                    style={{ backgroundColor: '#008055' }}
                  >
                    {t('profile.applyAsVendor')}
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            )}

            {!isLoading && vendor && editing && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={update('name')}
                  placeholder={t(
                    'profile.vendorNamePlaceholder'
                  )}
                  className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:border-teal-600"
                  style={{ borderColor: '#E2E8F0' }}
                />

                <input
                  type="text"
                  value={form.stallNumber}
                  onChange={update('stallNumber')}
                  placeholder={t(
                    'profile.stallNumberPlaceholder'
                  )}
                  className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:border-teal-600"
                  style={{ borderColor: '#E2E8F0' }}
                />

                <input
                  type="tel"
                  value={form.phone}
                  onChange={update('phone')}
                  placeholder={t(
                    'profile.phonePlaceholder'
                  )}
                  className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:border-teal-600"
                  style={{ borderColor: '#E2E8F0' }}
                />

                <select
                  value={form.productType}
                  onChange={update('productType')}
                  className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:border-teal-600 bg-white"
                  style={{ borderColor: '#E2E8F0' }}
                >
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1 text-white font-medium py-2 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: '#008055' }}
                  >
                    {saving ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <Check size={14} />
                    )}

                    {saving
                      ? t('profile.saving')
                      : t('profile.saveChanges')}
                  </button>

                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="px-4 border rounded-xl text-sm transition-all active:scale-95"
                    style={{
                      borderColor: '#E2E8F0',
                      color: '#64748B',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {!isLoading && vendor && !editing && (
              <div className="space-y-2">
                {[
                  {
                    icon: MapPin,
                    label: t('profile.stall'),
                    value:
                      vendor.stallNumber || '—',
                    color: '#008055',
                    bg: '#F0FDFA',
                  },
                  {
                    icon: Tag,
                    label: t('profile.product'),
                    value:
                      vendor.productType || '—',
                    color: '#042E80',
                    bg: '#F5F3FF',
                  },
                  {
                    icon: Phone,
                    label: t('profile.phone'),
                    value: vendor.phone || '—',
                    color: '#D97706',
                    bg: '#FFFBEB',
                  },
                ].map(
                  ({
                    icon: Icon,
                    label,
                    value,
                    color,
                    bg,
                  }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 py-2 px-1"
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: bg,
                        }}
                      >
                        <Icon
                          size={14}
                          style={{ color }}
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-medium">
                          {label}
                        </p>

                        <p className="text-sm font-medium text-slate-700 capitalize truncate">
                          {value}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── DISCONNECT CONFIRMATION MODAL (PORTAL + CENTERED) ── */}
      {showDisconnectModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(0,0,0,0.72)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() =>
            !isDisconnecting &&
            setShowDisconnectModal(false)
          }
        >
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden animate-scale-in"
            style={{
              backgroundColor: 'white',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  backgroundColor: '#FEF2F2',
                }}
              >
                <LogOut
                  size={28}
                  style={{ color: '#DC2626' }}
                />
              </div>

              <h3
                className="text-xl font-black text-slate-900 text-center mb-2"
                style={{
                  fontFamily:
                    "'Montserrat', sans-serif",
                }}
              >
                {t('profile.disconnectTitle')}
              </h3>

              <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
                {t('profile.disconnectMessage')}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setShowDisconnectModal(false)
                  }
                  disabled={isDisconnecting}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
                  style={{
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                  }}
                >
                  {t('profile.cancel')}
                </button>

                <button
                  onClick={handleDisconnectConfirm}
                  disabled={isDisconnecting}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: '#DC2626',
                  }}
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                      <span>{t('profile.disconnecting')}</span>
                    </>
                  ) : (
                    t('profile.disconnectConfirm')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}