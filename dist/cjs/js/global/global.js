/*can-util@3.0.0-pre.14#js/global/global*/
module.exports = function () {
    return typeof window !== 'undefined' ? window : typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope ? self : global;
};